import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { TourPipelineStorageService } from "@/providers/TourProvider/tourPipelineStorage/TourPipelineStorageService";
import type { SavedPipelineDocument } from "@/services/pipelineSpecService";
import { createAndAttachPipeline } from "@/services/projects/createAndAttachPipeline";
import { pipelineFileTarget } from "@/services/projects/pipelineResource";
import { getRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { pipelineStorageDb } from "./db";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { PipelineFile } from "./PipelineFile";
import { emitPipelineFileChanged } from "./pipelineFileEvents";
import { findPipelineMigration } from "./pipelineMigrations";
import * as registry from "./pipelineRegistry";
import { PipelineStorageService } from "./PipelineStorageService";
import { getEditorPipelineIdentity } from "./types";

vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn(), put: vi.fn() },
}));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock("./pipelineFileEvents", () => ({ emitPipelineFileChanged: vi.fn() }));
vi.mock("./createDriver", () => ({ createDriver: () => ({}) }));
vi.mock("./pipelineRegistry");
vi.mock("@/utils/localforage", () => ({
  getUseEnv: async () => false,
  getUseRelativePath: async () => false,
  getUserBackendUrl: async () => "https://backend.example.com",
}));
vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  availablePipelineName: async (name: string) => name,
}));
vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton",
  () => ({ exportPipeline: vi.fn() }),
);
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

const ref = {
  source: "remote",
  backendUrl: "https://backend.example.com",
  pipelineId: "pipeline-1",
} as const;
const spec = { name: "Original", implementation: { graph: { tasks: {} } } };
const document = {
  id: ref.pipelineId,
  user_id: "owner@example.com",
  file_path: "pipelines/original.yaml",
  pipeline_name: spec.name,
  root_pipeline_task: {
    componentRef: {
      digest: "old-digest",
      url: "https://components.example.com/original.yaml",
      text: "name: Original",
      spec,
    },
    arguments: { greeting: "hello" },
    annotations: { note: "Keep me" },
  },
  pipeline_run_annotations: { purpose: "example" },
};
const editedSpec = { ...spec, name: "Edited" };
const content = componentSpecToYaml(editedSpec);
const owner = { id: document.user_id, permissions: ["read", "write"] };
let storage: PipelineStorageService;

function response<T>(data: T, status = 200) {
  return {
    data,
    error: undefined,
    request: new Request(ref.backendUrl),
    response: new Response(null, { status }),
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  await LibraryDB.favorites.clear();
  await pipelineStorageDb.pipeline_migrations.clear();
  localStorage.clear();
  sessionStorage.clear();
  storage = new PipelineStorageService();
  vi.mocked(client.get).mockResolvedValue(response(structuredClone(document)));
  vi.mocked(client.put).mockResolvedValue(response(document));
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
});
afterEach(() => vi.unstubAllEnvs());

describe("PipelineStorageService editor resolution", () => {
  it("uploads, reopens, and edits pipeline input values using backend task arguments", async () => {
    const editorSpec = {
      ...spec,
      inputs: [{ name: "name", type: "String", value: "", optional: false }],
    };
    let saved: SavedPipelineDocument = structuredClone(document);
    vi.mocked(client.put).mockImplementation(async (options) => {
      const body = options?.body as Pick<
        SavedPipelineDocument,
        "root_pipeline_task" | "pipeline_run_annotations"
      >;
      expect(body.root_pipeline_task.componentRef.spec.inputs).toEqual([
        { name: "name", type: "String", optional: false },
      ]);
      saved = {
        ...saved,
        file_path: String(options?.query?.file_path),
        ...body,
      };
      return response(saved);
    });
    const file = await storage.createRemotePipeline(
      ref.backendUrl,
      "Original",
      componentSpecToYaml(editorSpec),
    );
    expect(saved.root_pipeline_task.arguments).toEqual({ name: "" });
    expect(componentSpecFromYaml(await file.read())).toEqual(editorSpec);

    vi.mocked(client.get).mockImplementation(async () => response(saved));
    const reopened = await storage.resolvePipeline(ref);
    const loaded = componentSpecFromYaml(await reopened.read());
    expect(loaded).toEqual(editorSpec);
    loaded.inputs![0].value = "Ada";
    await reopened.write(componentSpecToYaml(loaded));
    expect(saved.root_pipeline_task.arguments).toEqual({ name: "Ada" });
    expect(componentSpecFromYaml(await reopened.read())).toEqual(loaded);

    delete loaded.inputs![0].value;
    await reopened.write(componentSpecToYaml(loaded));
    expect(saved.root_pipeline_task.arguments).toEqual({});
    expect(componentSpecFromYaml(await reopened.read())).toEqual(loaded);
  });

  it("reads and edits the owned remote document without touching the local registry", async () => {
    const file = await storage.resolvePipeline(ref);
    expect(client.get).toHaveBeenCalledExactlyOnceWith({
      baseUrl: ref.backendUrl,
      url: "/api/pipelines/{pipeline_id}",
      path: { pipeline_id: ref.pipelineId },
    });
    expect(componentSpecFromYaml(await file.read())).toEqual(spec);
    expect(file.id).toBe(ref.pipelineId);
    expect(file.remote).toEqual({
      backendUrl: ref.backendUrl,
      pipelineId: ref.pipelineId,
    });
    expect(file.folder.canMoveFilesOut).toBe(false);
    expect(file.folder.driver.canEdit).toBe(true);
    await file.rename("Edited");
    expect(file.storageKey).toBe("Edited");
    expect(client.put).not.toHaveBeenCalled();
    await file.write(content);
    expect(client.put).toHaveBeenCalledExactlyOnceWith({
      baseUrl: ref.backendUrl,
      url: "/api/users/me/pipelines",
      query: { file_path: document.file_path },
      body: {
        root_pipeline_task: {
          ...document.root_pipeline_task,
          componentRef: { spec: editedSpec },
        },
        pipeline_run_annotations: document.pipeline_run_annotations,
      },
    });
    expect(getCurrentUserApiUsersMeGet).toHaveBeenLastCalledWith({
      baseUrl: ref.backendUrl,
    });
    expect(emitPipelineFileChanged).toHaveBeenCalledWith({
      storageKey: getEditorPipelineIdentity(ref),
      source: "v2",
    });
    await expect(file.deleteFile()).rejects.toThrow(
      "deletion is not supported",
    );
    expect(registry.updateEntry).not.toHaveBeenCalled();
    expect(registry.deleteEntry).not.toHaveBeenCalled();
    expect(registry.addEntry).not.toHaveBeenCalled();
    expect(registry.findByStorageKey).not.toHaveBeenCalled();
  });

  it.each([
    response({ ...owner, id: "other@example.com" }),
    response({ ...owner, id: null }),
    response({ ...owner, permissions: ["read"] }),
    response(undefined, 503),
  ])(
    "preserves reading but rechecks write access for every mutation: %j",
    async (user) => {
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(user);
      const readOnly = await storage.resolvePipeline(ref);
      expect(readOnly.folder.driver.canEdit).toBe(false);
      expect(componentSpecFromYaml(await readOnly.read())).toEqual(spec);
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
      const owned = await storage.resolvePipeline(ref);
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(user);
      for (const file of [readOnly, owned]) {
        await expect(file.write(content)).rejects.toThrow();
        await expect(file.rename("Changed")).rejects.toThrow();
        expect(file.storageKey).toBe("Original");
      }
      expect(client.put).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      { ...response(undefined, 422), error: { detail: "Invalid task" } },
      "Failed to save pipeline (422): Invalid task",
    ],
    [
      response({ ...document, file_path: "other.yaml" }),
      "unexpected file path",
    ],
    [response({ ...document, id: "other" }), "different pipeline"],
    [response({ ...document, user_id: "other" }), "different pipeline"],
  ] as const)(
    "rejects failed or mismatched writes without replacing the document: %j",
    async (result, error) => {
      const file = await storage.resolvePipeline(ref);
      vi.mocked(client.put).mockResolvedValue(result);
      await expect(file.write(content)).rejects.toThrow(error);
      expect(componentSpecFromYaml(await file.read())).toEqual(spec);
    },
  );

  it("serializes writes across document instances and waits for saves queued during reopen", async () => {
    const first = await storage.resolvePipeline(ref);
    const second = await storage.resolvePipeline(ref);
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let savedSpec = spec;
    const serverResponse = () =>
      response({
        ...document,
        root_pipeline_task: { componentRef: { spec: savedSpec } },
      });
    vi.mocked(client.put)
      .mockImplementationOnce(async () => {
        await pending;
        savedSpec = editedSpec;
        return serverResponse();
      })
      .mockImplementationOnce(async () => {
        savedSpec = { ...editedSpec, name: "Latest" };
        return serverResponse();
      });
    const firstWrite = first.write(content);
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    vi.mocked(client.get).mockImplementation(async () => serverResponse());
    const reopening = storage.resolvePipeline(ref);
    const secondWrite = second.write(
      componentSpecToYaml({ ...editedSpec, name: "Latest" }),
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(client.put).toHaveBeenCalledTimes(1);
      expect(client.get).toHaveBeenCalledTimes(2);
    } finally {
      release();
    }
    const [, , reopened] = await Promise.all([
      firstWrite,
      secondWrite,
      reopening,
    ]);
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenCalledTimes(3);
    expect(componentSpecFromYaml(await reopened.read()).name).toBe("Latest");
  });

  it("gives same-name Save As copies distinct remote identities without local registration", async () => {
    vi.mocked(client.put).mockImplementation(async (options) => {
      const path = String(options?.query?.file_path);
      return response({
        ...document,
        id: path,
        file_path: path,
        ...(options?.body as Partial<typeof document>),
      });
    });
    const first = await storage.createRemotePipeline(
      ref.backendUrl,
      "Copy",
      content,
    );
    const second = await storage.createRemotePipeline(
      ref.backendUrl,
      "Copy",
      content,
    );
    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toBe(document.file_path);
    expect(first.remote).toEqual({
      backendUrl: ref.backendUrl,
      pipelineId: first.id,
    });
    expect(first.folder.driver.canEdit).toBe(true);
    expect(componentSpecFromYaml(await first.read()).name).toBe("Copy");
    expect(registry.addEntry).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledWith({
      baseUrl: ref.backendUrl,
      url: "/api/users/me/pipelines",
      query: { file_path: first.id },
      body: {
        root_pipeline_task: {
          componentRef: { spec: { ...editedSpec, name: "Copy" } },
        },
        pipeline_run_annotations: {},
      },
    });
  });

  it.each([owner.id, "another-author@example.com"])(
    "copies remote task and run metadata while applying current edits (source owner: %s)",
    async (sourceOwner) => {
      const sourceDocument = {
        ...structuredClone(document),
        user_id: sourceOwner,
        root_pipeline_task: {
          ...structuredClone(document.root_pipeline_task),
          arguments: {
            greeting: "hello",
            token: { secret: { name: "example-token" } },
          },
          executionOptions: { retryStrategy: { maxRetries: 2 } },
        },
      };
      vi.mocked(client.get).mockResolvedValue(response(sourceDocument));
      const source = await storage.resolvePipeline(ref);
      const copiedTask = {
        ...sourceDocument.root_pipeline_task,
        componentRef: { spec: { ...editedSpec, name: "Copy" } },
      };
      vi.mocked(client.put).mockImplementation(async (options) => {
        const filePath = options?.query?.file_path;
        if (typeof filePath !== "string") throw new Error("Missing file path");
        return response({
          ...document,
          id: "copied-pipeline",
          file_path: filePath,
          root_pipeline_task: copiedTask,
        });
      });

      const copy = await storage.copyRemotePipeline(source, "Copy", content);

      expect(copy.id).toBe("copied-pipeline");
      expect(copy.folder.driver.canEdit).toBe(true);
      expect(client.put).toHaveBeenCalledExactlyOnceWith({
        baseUrl: ref.backendUrl,
        url: "/api/users/me/pipelines",
        query: { file_path: expect.not.stringContaining("original") },
        body: {
          root_pipeline_task: copiedTask,
          pipeline_run_annotations: sourceDocument.pipeline_run_annotations,
        },
      });
      expect(componentSpecFromYaml(await source.read())).toEqual(spec);
      expect(componentSpecFromYaml(await copy.read())).toEqual({
        ...editedSpec,
        name: "Copy",
      });
      expect(registry.addEntry).not.toHaveBeenCalled();
    },
  );

  it("propagates remote errors without resolving a local namesake", async () => {
    vi.mocked(client.get).mockRejectedValue(new Error("Remote unavailable"));
    const legacy = vi.spyOn(RootFolderDbStorageDriver.prototype, "hasKey");
    await expect(storage.resolvePipeline(ref)).rejects.toThrow(
      "Remote unavailable",
    );
    expect(registry.findById).not.toHaveBeenCalled();
    expect(registry.findByStorageKey).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
  });

  it("keeps file IDs and legacy name backfill for local pipelines", async () => {
    const file = await storage.resolvePipeline(ref);
    vi.spyOn(storage, "findPipelineById").mockResolvedValue(file);
    await expect(
      storage.resolvePipeline({ name: "Local", fileId: "local-id" }),
    ).resolves.toBe(file);
    expect(storage.findPipelineById).toHaveBeenCalledWith("local-id");
    vi.spyOn(storage, "resolvePipelineByName").mockResolvedValue(undefined);
    vi.spyOn(RootFolderDbStorageDriver.prototype, "hasKey").mockResolvedValue(
      true,
    );
    vi.spyOn(storage.rootFolder, "assignFile").mockResolvedValue(file);
    await expect(storage.resolvePipeline({ name: "Legacy" })).resolves.toBe(
      file,
    );
    expect(storage.rootFolder.assignFile).toHaveBeenCalledWith("Legacy");
  });

  it("resolves tour file IDs through their existing session-storage lookup", async () => {
    const tour = new TourPipelineStorageService();
    const file = await tour.rootFolder.addFile("Tour pipeline", content);
    const reopened = await tour.resolvePipeline({
      fileId: file.id,
      name: file.storageKey,
    });
    expect(await reopened.read()).toBe(content);
    expect(registry.findById).not.toHaveBeenCalled();
  });
});

describe("remote drafts and project attachment", () => {
  const draft = {
    source: "draft",
    backendUrl: ref.backendUrl,
    draftId: "draft-1",
    name: "Draft",
  } as const;
  const paths = () =>
    vi
      .mocked(client.put)
      .mock.calls.map(([options]) => options?.query?.file_path);
  beforeEach(() => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
    vi.mocked(client.put).mockImplementation(async (options) =>
      response({
        ...document,
        file_path: String(options?.query?.file_path),
        ...(options?.body as object),
      }),
    );
  });

  it("retains a closed draft until its final workarea owner releases it", async () => {
    const file = await storage.resolvePipeline(draft);
    const first = storage.retainRemoteDraft(draft.draftId)!;
    const second = storage.retainRemoteDraft(draft.draftId)!;
    storage.discardRemoteDraft(draft);
    expect(storage.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toBe(
      draft,
    );
    expect(first.file).toBe(file);
    first.release();
    first.release();
    await Promise.resolve();
    expect(storage.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toBe(
      draft,
    );
    second.release();
    await Promise.resolve();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("survives an ownership reconnect and waits for the reopened editor to save", async () => {
    const file = await storage.resolvePipeline(draft);
    const first = storage.retainRemoteDraft(draft.draftId)!;
    storage.discardRemoteDraft(draft);
    first.release();
    const second = storage.retainRemoteDraft(draft.draftId)!;
    await Promise.resolve();
    expect(await storage.resolvePipeline(draft)).toBe(file);
    second.release();
    await Promise.resolve();
    expect(storage.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toBe(
      draft,
    );
    storage.discardRemoteDraft(draft);
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("keeps drafts in memory, then serializes edits into one remote record", async () => {
    const file = await storage.resolvePipeline(draft);
    expect(await storage.resolvePipeline(draft)).toBe(file);
    expect(componentSpecFromYaml(await file.read()).name).toBe(draft.name);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
    expect(getCurrentUserApiUsersMeGet).not.toHaveBeenCalled();
    await file.rename("Edited");
    const first = file.write(content);
    const second = file.write(
      componentSpecToYaml({ ...editedSpec, description: "Second" }),
    );
    await first;
    const third = file.write(
      componentSpecToYaml({ ...editedSpec, description: "Third" }),
    );
    await Promise.all([second, third]);
    expect(new Set(paths()).size).toBe(1);
    expect(paths()[0]).not.toBe("pipelines/draft-1.yaml");
    expect(file.id).toBe(ref.pipelineId);
    expect(file.initialId).toBe(draft.draftId);
    expect(file.storageKey).toBe("Edited");
    expect(file.isDraft).toBe(false);
    expect(componentSpecFromYaml(await file.read()).description).toBe("Third");
    expect(registry.addEntry).not.toHaveBeenCalled();
    expect(registry.updateEntry).not.toHaveBeenCalled();
    storage.discardRemoteDraft(draft);
    expect(storage.getRemoteDraftRef(draft.draftId, ref.backendUrl)).toEqual(
      ref,
    );
    const reopened = await storage.resolvePipeline(draft);
    expect(reopened.remote?.pipelineId).toBe(ref.pipelineId);
    expect(client.put).toHaveBeenCalledTimes(3);
  });

  it("recovers a saved draft alias after recreating the storage service", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    const restored = new PipelineStorageService();
    expect(restored.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toEqual(
      ref,
    );
    const reopened = await restored.resolvePipeline(draft);
    expect(reopened.remote?.pipelineId).toBe(ref.pipelineId);
    expect(client.put).toHaveBeenCalledOnce();
  });

  it("copies a promoted draft through its retained driver", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    const copy = await storage.copyRemotePipeline(
      file,
      "Copied draft",
      content,
    );
    expect(copy.remote).toBeDefined();
    expect(new Set(paths()).size).toBe(2);
    expect(componentSpecFromYaml(await copy.read()).name).toBe("Copied draft");
  });

  it("allocates a fresh server path if an abandoned draft is recreated", async () => {
    const first = storage.createRemoteDraft(draft);
    await first.write(content);
    const second = storage.createRemoteDraft(draft);
    await second.write(content);
    expect(new Set(paths()).size).toBe(2);
  });

  it.each(["response", "permission"])(
    "retries a failed %s without changing identity",
    async (failure) => {
      const file = await storage.resolvePipeline(draft);
      if (failure === "response")
        vi.mocked(client.put).mockRejectedValueOnce(
          new Error("Connection lost"),
        );
      else
        vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValueOnce(
          response({ ...owner, permissions: ["read"] }),
        );
      await expect(file.write(content)).rejects.toThrow();
      expect(file.isDraft).toBe(true);
      await file.write(content);
      expect(file.isDraft).toBe(false);
      expect(new Set(paths()).size).toBe(1);
    },
  );

  it.each([false, true])(
    "attaches on first save and retries attachment failures (failure: %s)",
    async (fail) => {
      const attach = vi.fn().mockResolvedValue({});
      if (fail) attach.mockRejectedValueOnce(new Error("Refused"));
      const file = await createAndAttachPipeline({
        storage,
        name: "Project",
        provisionalName: true,
        attach,
      });
      expect(pipelineFileTarget(file).identity).toBe(`draft/${file.initialId}`);
      expect(attach).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      if (fail) {
        await expect(file.write(content)).rejects.toThrow(
          "Pipeline saved, but it could not be attached",
        );
        expect(file.isDraft).toBe(false);
        expect(pipelineFileTarget(file).identity).toBe(
          `remote/${ref.pipelineId}`,
        );
      }
      await file.write(content);
      await file.write(content);
      expect(pipelineFileTarget(file).identity).toBe(
        `remote/${ref.pipelineId}`,
      );
      expect(attach).toHaveBeenCalledTimes(fail ? 2 : 1);
      expect(client.put).toHaveBeenCalledTimes(2);
      expect(attach).toHaveBeenLastCalledWith({
        entity: "pipeline",
        entityId: ref.pipelineId,
        name: "Project",
      });
      expect(new Set(paths()).size).toBe(1);
      expect(registry.addEntry).not.toHaveBeenCalled();
    },
  );

  it("rolls back a local pipeline when attachment is refused", async () => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(storage.rootFolder, "addFile").mockResolvedValue({
      id: "local-1",
      storageKey: "Local",
      deleteFile,
    } as unknown as PipelineFile);
    await expect(
      createAndAttachPipeline({
        storage,
        name: "Local",
        attach: async () => {
          throw new Error("Refused");
        },
      }),
    ).rejects.toThrow("Refused");
    expect(deleteFile).toHaveBeenCalledOnce();
    expect(client.put).not.toHaveBeenCalled();
  });
});

describe("moving local pipelines to remote storage", () => {
  let local: PipelineFile;

  beforeEach(() => {
    local = new PipelineFile({
      id: "local-id",
      storageKey: "Original",
      folder: storage.rootFolder,
    });
    vi.spyOn(storage, "resolvePipeline").mockResolvedValue(local);
    vi.spyOn(local, "read").mockResolvedValue(content);
    vi.spyOn(local, "deleteFile").mockResolvedValue();
    vi.mocked(client.put).mockImplementation(async (options) =>
      response({
        ...document,
        file_path: String(options?.query?.file_path),
        ...(options?.body as Partial<typeof document>),
      }),
    );
  });

  it("waits for remote creation before removing the local pipeline", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: "Original",
      name: "Original",
    });
    let finishSave = () => {};
    const pending = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const save = vi.mocked(client.put).getMockImplementation()!;
    vi.mocked(client.put).mockImplementation(async (...args) => {
      await pending;
      return save(...args);
    });
    const moving = storage.moveLocalPipelineToRemote(
      "Original",
      ref.backendUrl,
    );
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(local.deleteFile).not.toHaveBeenCalled();
    expect(
      await LibraryDB.favorites.get(["pipeline", "Original"]),
    ).toBeDefined();
    finishSave();
    const remote = await moving;
    expect(storage.resolvePipeline).toHaveBeenCalledWith({ name: "Original" });
    expect(componentSpecFromYaml(await remote.read())).toEqual({
      ...editedSpec,
      name: "Original",
    });
    expect(local.deleteFile).toHaveBeenCalledExactlyOnceWith();
    expect(await LibraryDB.favorites.toArray()).toEqual([
      {
        type: "pipeline",
        id: getRemotePipelineSavedId(ref.backendUrl, remote.id),
        name: "Original",
        sortKey: 0,
      },
    ]);
  });

  it("moves links stored under the local name or file ID before deleting the file", async () => {
    await LibraryDB.favorites.bulkPut([
      { type: "pipeline", id: local.storageKey, name: "Old name" },
      { type: "pipeline", id: local.id, name: "Old name" },
      { type: "remote-pipeline", id: ref.pipelineId, name: "Stale name" },
      { type: "run", id: local.storageKey, name: "Unrelated run" },
      { type: "pipeline", id: "Other", name: "Other pipeline" },
    ]);
    const recent = [
      { type: "pipeline", id: local.id, name: "Old name", timestamp: 30 },
      { type: "pipeline", id: "Other", name: "Other pipeline", timestamp: 20 },
      {
        type: "pipeline",
        id: local.storageKey,
        name: "Original",
        timestamp: 10,
      },
    ];
    for (const key of ["Home/recently_viewed", "Home/recently_used"]) {
      localStorage.setItem(key, JSON.stringify(recent));
    }
    vi.mocked(local.deleteFile).mockImplementation(async () => {
      expect(
        await LibraryDB.favorites.get(["pipeline", local.id]),
      ).toBeUndefined();
      expect(
        await LibraryDB.favorites.get(["pipeline", local.storageKey]),
      ).toBeUndefined();
      for (const key of ["Home/recently_viewed", "Home/recently_used"]) {
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
          {
            type: "pipeline",
            id: getRemotePipelineSavedId(ref.backendUrl, ref.pipelineId),
            name: "Original",
            timestamp: 30,
          },
          recent[1],
        ]);
      }
    });

    await storage.moveLocalPipelineToRemote("Original", ref.backendUrl);

    expect(await LibraryDB.favorites.toArray()).toEqual([
      { type: "pipeline", id: "Other", name: "Other pipeline", sortKey: 1 },
      {
        type: "pipeline",
        id: getRemotePipelineSavedId(ref.backendUrl, ref.pipelineId),
        name: "Original",
        sortKey: 0,
      },
      { type: "run", id: local.storageKey, name: "Unrelated run", sortKey: 4 },
    ]);
    expect(local.deleteFile).toHaveBeenCalledOnce();
  });

  it("does not create favorites or history for a pipeline without saved links", async () => {
    await storage.moveLocalPipelineToRemote("Original", ref.backendUrl);
    expect(await LibraryDB.favorites.count()).toBe(0);
    expect(localStorage.getItem("Home/recently_viewed")).toBeNull();
    expect(localStorage.getItem("Home/recently_used")).toBeNull();
  });

  it("uses a resolved file's current name and updates project links before deletion", async () => {
    const onCreated = vi.fn(async (remote: PipelineFile) => {
      expect(remote.storageKey).toBe(local.storageKey);
      expect(local.deleteFile).not.toHaveBeenCalled();
    });
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl, onCreated);
    expect(storage.resolvePipeline).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledOnce();
    expect(local.deleteFile).toHaveBeenCalledOnce();
  });

  it("keeps the local pipeline if updating project links fails", async () => {
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, async () => {
        throw new Error("Project unavailable");
      }),
    ).rejects.toThrow("saved links could not be updated");
    expect(local.deleteFile).not.toHaveBeenCalled();
    // A retry must not overwrite edits made to the already-created remote.
    vi.mocked(client.get).mockResolvedValue(
      response({
        ...document,
        root_pipeline_task: {
          componentRef: { spec: { ...spec, description: "Remote edit" } },
        },
      }),
    );
    const remote = await storage.moveLocalPipelineToRemote(
      local,
      "https://other.example.com",
    );
    expect(componentSpecFromYaml(await remote.read()).description).toBe(
      "Remote edit",
    );
    expect(remote.remote).toEqual({
      backendUrl: ref.backendUrl,
      pipelineId: ref.pipelineId,
    });
    expect(
      (await findPipelineMigration({ name: "Original", fileId: local.id }))
        ?.remote,
    ).toEqual(ref);
    expect(
      vi
        .mocked(client.put)
        .mock.calls.map(([options]) => options?.query?.file_path),
    ).toEqual([`pipelines/${local.id}.yaml`]);
  });

  it("resolves old project IDs and names after migration and a fresh service instance", async () => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl);
    const reopened = new PipelineStorageService();
    vi.spyOn(reopened, "resolvePipelineByName").mockResolvedValue(undefined);
    vi.spyOn(RootFolderDbStorageDriver.prototype, "hasKey").mockResolvedValue(
      false,
    );
    for (const oldRef of [
      { name: local.storageKey, fileId: local.id },
      { name: local.storageKey },
    ]) {
      expect((await reopened.resolvePipeline(oldRef)).remote).toEqual({
        backendUrl: ref.backendUrl,
        pipelineId: ref.pipelineId,
      });
    }
    expect(client.put).toHaveBeenCalledTimes(1);

    const namesake = new PipelineFile({
      id: "new-local-id",
      storageKey: local.storageKey,
      folder: reopened.rootFolder,
    });
    vi.mocked(reopened.resolvePipelineByName).mockResolvedValue(namesake);
    expect(await reopened.resolvePipeline({ name: local.storageKey })).toBe(
      namesake,
    );
    expect(
      (
        await reopened.resolvePipeline({
          name: "Old project label",
          fileId: local.id,
        })
      ).remote?.pipelineId,
    ).toBe(ref.pipelineId);
    await expect(
      reopened.resolvePipeline({
        name: local.storageKey,
        fileId: "missing-id",
      }),
    ).rejects.toThrow("Pipeline not found");
  });

  it("keeps earlier ID links when another pipeline with the same name is migrated", async () => {
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl);
    const namesake = new PipelineFile({
      id: "new-local-id",
      storageKey: local.storageKey,
      folder: storage.rootFolder,
    });
    vi.spyOn(namesake, "read").mockResolvedValue(content);
    vi.spyOn(namesake, "deleteFile").mockResolvedValue();
    vi.mocked(client.put).mockResolvedValue(
      response({
        ...document,
        id: "remote-2",
        file_path: "pipelines/new-local-id.yaml",
      }),
    );
    await storage.moveLocalPipelineToRemote(namesake, ref.backendUrl);
    expect(
      (
        await findPipelineMigration({
          name: local.storageKey,
          fileId: local.id,
        })
      )?.remote.pipelineId,
    ).toBe(ref.pipelineId);
    expect(
      (await findPipelineMigration({ name: local.storageKey }))?.remote
        .pipelineId,
    ).toBe("remote-2");
  });

  it("keeps the local file when its project-link mapping cannot be saved", async () => {
    vi.spyOn(
      pipelineStorageDb.pipeline_migrations,
      "bulkPut",
    ).mockRejectedValue(new Error("Storage unavailable"));
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow("saved links could not be updated");
    expect(local.deleteFile).not.toHaveBeenCalled();
  });

  it.each(["read", "save"])(
    "keeps the local pipeline when %s fails",
    async (step) => {
      const favorite = {
        type: "pipeline",
        id: local.storageKey,
        name: "Original",
      } as const;
      await LibraryDB.favorites.put(favorite);
      const recent = JSON.stringify([{ ...favorite, timestamp: 1 }]);
      localStorage.setItem("Home/recently_viewed", recent);
      const error = new Error("Unavailable");
      if (step === "read") vi.mocked(local.read).mockRejectedValue(error);
      else vi.mocked(client.put).mockRejectedValue(error);
      await expect(
        storage.moveLocalPipelineToRemote("Original", ref.backendUrl),
      ).rejects.toThrow("Unavailable");
      expect(local.deleteFile).not.toHaveBeenCalled();
      expect(await LibraryDB.favorites.toArray()).toEqual([favorite]);
      expect(localStorage.getItem("Home/recently_viewed")).toBe(recent);
    },
  );

  it("keeps the local file if favorites cannot be migrated", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: local.storageKey,
      name: "Original",
    });
    vi.spyOn(LibraryDB.favorites, "put").mockRejectedValue(
      new Error("Storage unavailable"),
    );

    await expect(
      storage.moveLocalPipelineToRemote("Original", ref.backendUrl),
    ).rejects.toThrow(
      "Pipeline was uploaded, but its saved links could not be updated. The copy in this browser was kept.",
    );

    expect(local.deleteFile).not.toHaveBeenCalled();
    expect(
      await LibraryDB.favorites.get(["pipeline", local.storageKey]),
    ).toBeDefined();
  });

  it("keeps the local file if recent links cannot be saved", async () => {
    localStorage.setItem(
      "Home/recently_viewed",
      JSON.stringify([
        {
          type: "pipeline",
          id: local.storageKey,
          name: "Original",
          timestamp: 1,
        },
      ]),
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    await expect(
      storage.moveLocalPipelineToRemote("Original", ref.backendUrl),
    ).rejects.toThrow("saved links could not be updated");

    expect(local.deleteFile).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem("Home/recently_viewed")!)[0].type,
    ).toBe("pipeline");
  });

  it("reports that the remote copy exists if local removal fails", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: local.storageKey,
      name: "Original",
    });
    vi.mocked(local.deleteFile).mockRejectedValue(
      new Error("Storage unavailable"),
    );
    await expect(
      storage.moveLocalPipelineToRemote("Original", ref.backendUrl),
    ).rejects.toThrow(
      "Pipeline was uploaded, but the copy in this browser could not be removed.",
    );
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(await LibraryDB.favorites.toArray()).toEqual([
      {
        type: "pipeline",
        id: getRemotePipelineSavedId(ref.backendUrl, ref.pipelineId),
        name: "Original",
        sortKey: 0,
      },
    ]);
  });
});
