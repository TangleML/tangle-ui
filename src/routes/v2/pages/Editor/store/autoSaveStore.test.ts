import { runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ComponentSpec,
  serializeComponentSpecToText,
} from "@/models/componentSpec";
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
  const store = new AutoSaveStore(new UndoStore(), files, storage);
  store.init(spec, file.referenceId);
  return { file, write, spec, files, store };
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
    store.init(
      new ComponentSpec({ $id: "other", name: "Other" }),
      next.referenceId,
    );
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
    store.init(spec, file.referenceId);
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
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    spec.setDescription("Newest remote edit");
    expect(file.persistRecovery).toHaveBeenLastCalledWith(
      serializeComponentSpecToText(spec),
    );
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).toHaveBeenCalledTimes(2);
    firstWrite.resolve();
    await vi.advanceTimersByTimeAsync(0);
    store.dispose();
  });

  it("does not upload recovered unsaved work until the user edits or retries", async () => {
    const { store, file, write, spec } = setup();
    store.dispose();
    vi.spyOn(file, "storageKind", "get").mockReturnValue("remote");
    vi.spyOn(file, "saveError", "get").mockReturnValue("Not saved to server");
    store.init(spec, file.referenceId);
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
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(storage.migratePipeline).toHaveBeenCalledExactlyOnceWith(file);
    expect(file.storageKind).toBe("remote");
    expect(store.hasUnsavedChanges).toBe(false);

    spec.setDescription("Remote edit");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
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
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(write).toHaveBeenCalledWith(serializeComponentSpecToText(spec));
    expect(file.storageKind).toBe("local");
    expect(store.error).toBe("Offline");
    expect(store.hasUnsavedChanges).toBe(true);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS * 2);
    expect(storage.migratePipeline).toHaveBeenCalledTimes(1);

    spec.setDescription("Latest edit");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
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
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    spec.setDescription("Edit during upload");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
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

  it("persists and uploads a revert to the original after the first upload fails", async () => {
    const { store, storage, spec, file, write } = setupRemote();
    const original = serializeComponentSpecToText(spec);
    storage.migratePipeline.mockRejectedValueOnce(new Error("Offline"));
    spec.setDescription("Failed upload");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
    expect(store.error).toBe("Offline");

    spec.setDescription(undefined);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_TIME_MS);
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
});
