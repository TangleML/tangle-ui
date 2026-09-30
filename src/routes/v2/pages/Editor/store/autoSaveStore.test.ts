import { runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ComponentSpec,
  Input,
  serializeComponentSpecToText,
} from "@/models/componentSpec";
import { saveUndoHistory } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";

import { AutoSaveStore } from "./autoSaveStore";
import { PipelineFileStore } from "./pipelineFileStore";
import { UndoStore } from "./undoStore";

vi.mock("@/services/pipelineStorage/createDriver", () => ({
  createDriver: vi.fn(),
}));
vi.mock("@/services/pipelineStorage/db", () => ({ pipelineStorageDb: {} }));
vi.mock("@/services/pipelineStorage/pipelineRegistry", () => ({
  updateEntry: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Editor/utils/undoHistoryStorage", () => ({
  saveUndoHistory: vi.fn(),
}));

function createFile(name = "Pipeline") {
  const folder = new PipelineFolder({
    id: "folder",
    name: "Root",
    parentId: null,
    driver: {
      type: "test",
      allowsMoveIn: true,
      allowsMoveOut: true,
      list: async () => [],
      read: async () => "",
      write: async () => {},
      rename: async () => {},
      delete: async () => {},
      hasKey: async () => true,
    },
  });
  return new PipelineFile({ id: name, storageKey: name, folder });
}

function createPendingWrite() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(
  storage?: Pick<PipelineStorageService, "canMigrate" | "migratePipeline">,
) {
  const file = createFile();
  const write = vi.spyOn(file, "write").mockResolvedValue();
  vi.spyOn(file, "persistRecovery").mockResolvedValue();
  const spec = new ComponentSpec({ $id: "spec", name: "Pipeline" });
  const files = new PipelineFileStore();
  files.init(file);
  const undo = new UndoStore();
  const store = new AutoSaveStore(undo, files, storage);
  store.init(spec);
  return { file, write, spec, files, store, undo };
}

function setupRemote() {
  const remote = createFile("Remote pipeline");
  vi.spyOn(remote, "storageKind", "get").mockReturnValue("remote");
  const remoteWrite = vi.spyOn(remote, "write").mockResolvedValue();
  const storage = {
    canMigrate: (file: PipelineFile) => file.storageKind === "local",
    migratePipeline: vi.fn(async (file: PipelineFile) => {
      runInAction(() => {
        file.redirectedFile = remote;
      });
      return remote;
    }),
  };
  const session = setup(storage);
  session.write.mockImplementation(async (content) => {
    await session.file.redirectedFile?.write(content);
  });
  return { ...session, storage, remote, remoteWrite };
}

function setupRemoteEditor() {
  const context = setup();
  context.store.dispose();
  vi.spyOn(context.file, "storageKind", "get").mockReturnValue("remote");
  const input = new Input({ $id: "input", name: "Value" });
  context.spec.addInput(input);
  context.store.init(context.spec);
  const move = (x: number) =>
    context.spec.updateNodePosition(input.$id, { x, y: 0 });
  return { ...context, input, move };
}

describe("AutoSaveStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not overwrite the server when opening or closing an unchanged pipeline", async () => {
    const { store, write } = setup();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    await store.save();
    store.dispose();
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
  });

  it.each(["autosave", "save", "dispose"] as const)(
    "flushes delayed recovery after an immediate remote edit and revert on %s",
    async (trigger) => {
      const { store, file, spec, write } = setup();
      vi.spyOn(file, "storageKind", "get").mockReturnValue("remote");
      const original = serializeComponentSpecToText(spec);
      const recovery = createPendingWrite();
      let dirty = false;
      vi.mocked(file.persistRecovery).mockImplementation(async () => {
        await recovery.promise;
        dirty = true;
      });
      vi.spyOn(file, "saveError", "get").mockImplementation(() =>
        dirty ? "Not saved to server" : undefined,
      );
      write.mockImplementation(async () => {
        await recovery.promise;
        dirty = false;
      });

      spec.setDescription("Temporary edit");
      spec.setDescription(undefined);
      expect(store.hasUnsavedChanges).toBe(true);
      if (trigger === "autosave") {
        await vi.advanceTimersByTimeAsync(1000);
        expect(write).toHaveBeenCalledExactlyOnceWith(original);
      }
      const saving = trigger === "dispose" ? store.dispose() : store.save();
      await Promise.resolve();
      expect(write).toHaveBeenCalledExactlyOnceWith(original);

      recovery.resolve();
      expect(await saving).toBe(true);
      expect(dirty).toBe(false);
      if (trigger !== "dispose") expect(store.hasUnsavedChanges).toBe(false);
      await store.dispose();
      expect(write).toHaveBeenCalledOnce();
    },
  );

  it("keeps newer recovery pending when an earlier save finishes", async () => {
    const { store, file, spec, write } = setup();
    vi.spyOn(file, "storageKind", "get").mockReturnValue("remote");
    const pendingWrite = createPendingWrite();
    write.mockReturnValueOnce(pendingWrite.promise);
    spec.setDescription("First edit");
    const saving = store.save();
    await Promise.resolve();

    spec.setDescription("Temporary edit");
    spec.setDescription("First edit");
    pendingWrite.resolve();
    expect(await saving).toBe(true);
    expect(store.hasUnsavedChanges).toBe(true);
    await store.dispose();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(serializeComponentSpecToText(spec));
  });

  it("persists undo history under the current local name after a stable-file rename", async () => {
    const { store, file, spec, undo } = setup();
    undo.init(spec);
    await file.rename("Renamed pipeline");
    spec.setName("Renamed pipeline");
    await store.save();
    spec.setDescription("An edit after renaming");
    await store.save();

    expect(saveUndoHistory).toHaveBeenLastCalledWith(
      "Renamed pipeline",
      expect.any(Array),
      undo.undoManager,
    );
    expect(saveUndoHistory).not.toHaveBeenCalledWith(
      "Pipeline",
      expect.anything(),
      expect.anything(),
    );
    await store.dispose();
    undo.dispose();
  });

  it("serializes overlapping autosaves so the newer edit is written last", async () => {
    const { store, write, spec } = setup();
    const firstWrite = createPendingWrite();
    write.mockImplementationOnce(() => firstWrite.promise);
    spec.setDescription("First edit");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    spec.setDescription("Latest edit");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.isSaving).toBe(true);
    firstWrite.resolve();
    await store.save();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(serializeComponentSpecToText(spec));
    expect(store.isSaving).toBe(false);
    expect(store.hasUnsavedChanges).toBe(false);
    store.dispose();
  });

  it("keeps failed edits pending and retries the current definition", async () => {
    const { store, write, spec } = setup();
    write.mockRejectedValueOnce(new Error("Server unavailable"));
    spec.setDescription("Pending edit");
    expect(await store.save()).toBe(false);
    expect(store.error).toBe("Server unavailable");
    expect(store.hasUnsavedChanges).toBe(true);
    expect(store.lastSavedAt).toBeNull();
    expect(await store.save()).toBe(true);
    expect(write).toHaveBeenLastCalledWith(serializeComponentSpecToText(spec));
    expect(store.error).toBeNull();
    expect(store.hasUnsavedChanges).toBe(false);
    store.dispose();
  });

  it("flushes edits on navigation without letting the old completion change the new session", async () => {
    const { store, write, spec, files } = setup();
    const firstWrite = createPendingWrite();
    write.mockImplementationOnce(() => firstWrite.promise);
    spec.setDescription("First pipeline edit");
    store.dispose();
    const next = createFile("Other pipeline");
    const nextWrite = vi.spyOn(next, "write").mockResolvedValue();
    files.init(next);
    store.init(new ComponentSpec({ $id: "other", name: "Other" }));
    firstWrite.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(nextWrite).not.toHaveBeenCalled();
    expect(store.lastSavedAt).toBeNull();
    expect(store.error).toBeNull();
    store.dispose();
  });

  it("never starts autosave for a pipeline the user cannot edit", async () => {
    const { store, file, spec, write } = setup();
    store.dispose();
    vi.spyOn(file, "canEdit", "get").mockReturnValue(false);
    store.init(spec);
    spec.setDescription("No write allowed");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(await store.save()).toBe(false);
    store.dispose();
    expect(write).not.toHaveBeenCalled();
  });

  it("stages each remote edit locally while a previous server save is still pending", async () => {
    const { store, file, write, spec } = setup();
    vi.spyOn(file, "storageKind", "get").mockReturnValue("remote");
    const firstWrite = createPendingWrite();
    write.mockImplementationOnce(() => firstWrite.promise);
    spec.setDescription("First remote edit");
    await vi.advanceTimersByTimeAsync(1000);
    spec.setDescription("Newest remote edit");
    expect(file.persistRecovery).toHaveBeenLastCalledWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(1);
    firstWrite.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(2);
    store.dispose();
  });

  it("does not upload recovered unsaved work until the user edits or retries", async () => {
    const { store, file, write, spec } = setup();
    store.dispose();
    vi.spyOn(file, "storageKind", "get").mockReturnValue("remote");
    vi.spyOn(file, "saveError", "get").mockReturnValue("Not saved to server");
    store.init(spec);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).not.toHaveBeenCalled();
    expect(await store.save()).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    store.dispose();
  });

  it("uploads an unchanged local pipeline on explicit save without replacing its model", async () => {
    const { store, file, files, spec, storage, write } = setupRemote();

    expect(await store.save()).toBe(true);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(files.activePipelineFile).toBe(file);
    expect(file.storageKind).toBe("remote");
    expect(await store.save()).toBe(true);
    expect(storage.migratePipeline).toHaveBeenCalledExactlyOnceWith(file);
    store.dispose();
  });

  it("retries a failed explicit upload without reopening the editor", async () => {
    const { store, file, storage } = setupRemote();
    storage.migratePipeline.mockRejectedValueOnce(
      new Error("Server unavailable"),
    );

    expect(await store.save()).toBe(false);
    expect(file.storageKind).toBe("local");
    expect(store.error).toBe("Server unavailable");
    expect(store.isSaving).toBe(false);
    expect(await store.save()).toBe(true);
    expect(storage.migratePipeline).toHaveBeenCalledTimes(2);
    expect(store.error).toBeNull();
    store.dispose();
  });

  it("does not upload when saving the local draft fails", async () => {
    const { store, spec, storage, write } = setupRemote();
    write.mockRejectedValueOnce(new Error("Local storage unavailable"));
    spec.setDescription("Cannot save yet");

    expect(await store.save()).toBe(false);
    expect(storage.migratePipeline).not.toHaveBeenCalled();
    expect(store.isSaving).toBe(false);
    store.dispose();
  });

  it("does not publish an unchanged local pipeline just by opening or closing it", async () => {
    const { store, storage, write } = setupRemote();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS * 2);
    store.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).not.toHaveBeenCalled();
    expect(storage.migratePipeline).not.toHaveBeenCalled();
  });

  it("automatically publishes the first local edit and autosaves later edits remotely", async () => {
    const { store, storage, spec, file, write, remoteWrite } = setupRemote();
    spec.setDescription("First edit");
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(storage.migratePipeline).toHaveBeenCalledExactlyOnceWith(file);
    expect(file.storageKind).toBe("remote");
    expect(store.hasUnsavedChanges).toBe(false);

    spec.setDescription("Remote edit");
    await vi.advanceTimersByTimeAsync(1000);
    expect(remoteWrite).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    expect(storage.migratePipeline).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it("retains a failed automatic upload locally and retries on the next edit", async () => {
    const { store, storage, spec, file, write } = setupRemote();
    storage.migratePipeline.mockRejectedValueOnce(new Error("Offline"));
    spec.setDescription("Recoverable edit");
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(file.storageKind).toBe("local");
    expect(store.error).toBe("Offline");
    expect(store.hasUnsavedChanges).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(storage.migratePipeline).toHaveBeenCalledTimes(1);

    spec.setDescription("Latest edit");
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.migratePipeline).toHaveBeenCalledTimes(2);
    expect(file.storageKind).toBe("remote");
    expect(store.error).toBeNull();
    expect(store.hasUnsavedChanges).toBe(false);
    store.dispose();
  });

  it("saves edits made during the first upload remotely after it finishes", async () => {
    const { store, storage, spec, file, remote, write, remoteWrite } =
      setupRemote();
    const upload = createPendingWrite();
    storage.migratePipeline.mockImplementationOnce(async () => {
      await upload.promise;
      runInAction(() => {
        file.redirectedFile = remote;
      });
      return remote;
    });
    spec.setDescription("Uploading edit");
    await vi.advanceTimersByTimeAsync(1000);
    spec.setDescription("Edit during upload");
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.isSaving).toBe(true);

    upload.resolve();
    expect(await store.save()).toBe(true);
    expect(remoteWrite).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    expect(storage.migratePipeline).toHaveBeenCalledTimes(1);
    expect(store.hasUnsavedChanges).toBe(false);
    store.dispose();
  });

  it.each(["autosave", "dispose"] as const)(
    "flushes recovery reverted to the first upload's content on %s",
    async (trigger) => {
      const { store, storage, spec, file, remote, remoteWrite } = setupRemote();
      const upload = createPendingWrite();
      storage.migratePipeline.mockImplementationOnce(async () => {
        await upload.promise;
        runInAction(() => {
          file.redirectedFile = remote;
        });
        return remote;
      });
      spec.setDescription("Uploading edit");
      await vi.advanceTimersByTimeAsync(1000);
      const saving = store.save();
      expect(storage.migratePipeline).toHaveBeenCalledOnce();

      spec.setDescription("Temporary edit during upload");
      spec.setDescription("Uploading edit");
      if (trigger === "autosave") await vi.advanceTimersByTimeAsync(1000);
      expect(remoteWrite).not.toHaveBeenCalled();

      upload.resolve();
      expect(await saving).toBe(true);
      try {
        if (trigger === "dispose") await store.dispose();
        expect(remoteWrite).toHaveBeenCalledExactlyOnceWith(
          serializeComponentSpecToText(spec),
        );
        expect(storage.migratePipeline).toHaveBeenCalledOnce();
      } finally {
        await store.dispose();
      }
    },
  );

  it("persists and uploads a revert to the original after the first upload fails", async () => {
    const { store, storage, spec, file, write } = setupRemote();
    const original = serializeComponentSpecToText(spec);
    storage.migratePipeline.mockRejectedValueOnce(new Error("Offline"));
    spec.setDescription("Failed upload");
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.error).toBe("Offline");

    spec.setDescription(undefined);
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenLastCalledWith(original);
    expect(storage.migratePipeline).toHaveBeenCalledTimes(2);
    expect(file.storageKind).toBe("remote");
    expect(store.error).toBeNull();
    store.dispose();
  });

  it("waits for queued edits to finish before deletion", async () => {
    const { store, spec, write } = setup();
    const pending = createPendingWrite();
    write.mockReturnValueOnce(pending.promise);
    spec.setDescription("In-flight edit");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    spec.setDescription("Last edit before deletion");

    const finished = vi.fn();
    const disposing = store.dispose().then(finished);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(finished).not.toHaveBeenCalled();
    pending.resolve();
    await disposing;
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(serializeComponentSpecToText(spec));
    expect(finished).toHaveBeenCalledOnce();
  });

  it("saves edits made while deletion is pending when autosave resumes", async () => {
    const { store, spec, write } = setup();
    const savedYaml = serializeComponentSpecToText(spec);
    await store.dispose();

    spec.setDescription("Edit made while deletion was pending");
    store.init(spec, { savedYaml });

    expect(store.hasUnsavedChanges).toBe(true);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    expect(store.hasUnsavedChanges).toBe(false);
    await store.dispose();
  });

  it("keeps autosaves local when the storage service cannot migrate the file", async () => {
    const storage = {
      canMigrate: vi.fn().mockReturnValue(false),
      migratePipeline: vi.fn(),
    };
    const { store, spec, file, write } = setup(storage);
    spec.setDescription("Local-only edit");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(storage.canMigrate).toHaveBeenCalledWith(file);
    expect(storage.migratePipeline).not.toHaveBeenCalled();
    store.dispose();
  });

  it("batches repeated moves from the first move rather than the last", async () => {
    const { store, spec, move, write, file } = setupRemoteEditor();
    move(1);
    expect(file.persistRecovery).toHaveBeenLastCalledWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(900);
    move(2);
    await vi.advanceTimersByTimeAsync(900);
    move(3);
    await vi.advanceTimersByTimeAsync(1100);
    move(4);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    expect(store.hasUnsavedChanges).toBe(false);

    move(5);
    await vi.advanceTimersByTimeAsync(2999);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(6000);
    expect(write).toHaveBeenCalledTimes(2);
    await store.dispose();
  });

  it("debounces values for one second without letting movement delay them", async () => {
    const { store, spec, input, move, write } = setupRemoteEditor();
    input.setValue("First");
    await vi.advanceTimersByTimeAsync(600);
    input.setValue("Latest");
    await vi.advanceTimersByTimeAsync(900);
    move(30);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledTimes(1);
    await store.dispose();
  });

  it("includes a recent content change in an already scheduled movement save", async () => {
    const { store, spec, input, move, write } = setupRemoteEditor();
    move(1);
    await vi.advanceTimersByTimeAsync(2800);
    input.setValue("Latest");
    await vi.advanceTimersByTimeAsync(200);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledTimes(1);
    await store.dispose();
  });

  it("saves content earlier than a pending movement upload", async () => {
    const { store, spec, input, move, write } = setupRemoteEditor();
    move(1);
    await vi.advanceTimersByTimeAsync(200);
    input.setValue("Latest");
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledTimes(1);
    await store.dispose();
  });

  it("keeps only the newest follow-up behind a slow remote save", async () => {
    const { store, spec, input, move, file, write } = setupRemoteEditor();
    const first = createPendingWrite();
    write.mockImplementationOnce(() => first.promise);
    input.setValue("Uploading");
    await vi.advanceTimersByTimeAsync(1000);
    for (const value of ["Intermediate", "Another", "Latest"]) {
      input.setValue(value);
      await vi.advanceTimersByTimeAsync(1000);
    }
    move(40);
    expect(file.persistRecovery).toHaveBeenLastCalledWith(
      serializeComponentSpecToText(spec),
    );
    expect(write).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(serializeComponentSpecToText(spec));
    expect(store.isSaving).toBe(false);
    expect(store.hasUnsavedChanges).toBe(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledTimes(2);
    await store.dispose();
  });

  it("flushes movement immediately on explicit save without a later duplicate", async () => {
    const { store, spec, move, write } = setupRemoteEditor();
    move(20);
    expect(await store.save()).toBe(true);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledTimes(1);
    await store.dispose();
  });

  it("does not duplicate a manual save of identical in-flight content", async () => {
    const { store, input, write } = setupRemoteEditor();
    const first = createPendingWrite();
    write.mockImplementationOnce(() => first.promise);
    input.setValue("Uploading");
    await vi.advanceTimersByTimeAsync(1000);
    const manual = store.save();
    first.resolve();
    expect(await manual).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    await store.dispose();
  });

  it.each(["autosave", "save", "dispose"] as const)(
    "flushes recovery staged back to in-flight content on %s",
    async (trigger) => {
      const { store, spec, input, write } = setupRemoteEditor();
      const first = createPendingWrite();
      write.mockImplementationOnce(() => first.promise);
      input.setValue("Uploading");
      await vi.advanceTimersByTimeAsync(1000);
      input.setValue("Temporary");
      input.setValue("Uploading");
      if (trigger === "autosave") await vi.advanceTimersByTimeAsync(1000);
      const saving =
        trigger === "autosave"
          ? undefined
          : trigger === "dispose"
            ? store.dispose()
            : store.save();
      expect(write).toHaveBeenCalledTimes(1);

      first.resolve();
      if (saving) expect(await saving).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(write).toHaveBeenCalledTimes(2);
      expect(write).toHaveBeenLastCalledWith(
        serializeComponentSpecToText(spec),
      );
      if (trigger !== "dispose") expect(store.hasUnsavedChanges).toBe(false);
      await store.dispose();
      await vi.advanceTimersByTimeAsync(4000);
      expect(write).toHaveBeenCalledTimes(2);
    },
  );

  it("saves a revert while different content is in flight", async () => {
    const { store, spec, input, write } = setupRemoteEditor();
    const original = serializeComponentSpecToText(spec);
    const first = createPendingWrite();
    write.mockImplementationOnce(() => first.promise);
    input.setValue("Uploading");
    await vi.advanceTimersByTimeAsync(1000);
    input.setValue(undefined);
    expect(store.hasUnsavedChanges).toBe(true);
    const manual = store.save();
    first.resolve();
    expect(await manual).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(original);
    expect(store.hasUnsavedChanges).toBe(false);
    await store.dispose();
  });

  it("flushes the original snapshot when an edit is undone before its timer expires", async () => {
    const { store, spec, input, write } = setupRemoteEditor();
    const original = serializeComponentSpecToText(spec);
    input.setValue("Temporary");
    input.setValue(undefined);
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledExactlyOnceWith(original);
    expect(store.hasUnsavedChanges).toBe(false);
    await store.dispose();
  });

  it("flushes movement on navigation and cancels the old session's timer", async () => {
    const { store, spec, files, move, write } = setupRemoteEditor();
    move(20);
    const finishing = store.dispose();
    const next = createFile("Next");
    const nextWrite = vi.spyOn(next, "write").mockResolvedValue();
    files.init(next);
    store.init(new ComponentSpec({ name: "Next" }));
    await finishing;
    await vi.advanceTimersByTimeAsync(4000);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      serializeComponentSpecToText(spec),
    );
    expect(nextWrite).not.toHaveBeenCalled();
    expect(store.lastSavedAt).toBeNull();
    await store.dispose();
  });
});
