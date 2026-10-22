import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { TourPipelineStorageService } from "@/providers/TourProvider/tourPipelineStorage/TourPipelineStorageService";
import type { SavedPipelineDocument } from "@/services/pipelineSpecService";
import { migrateLocalPipelineOnOpen } from "@/services/pipelineStorage/migrateLocalPipelineOnOpen";
import { createAndAttachPipeline } from "@/services/projects/createAndAttachPipeline";
import { pipelineFileTarget } from "@/services/projects/pipelineResource";
import {
  createProjectResource,
  deleteProjectResource,
  listProjectResources,
} from "@/services/projects/projectResourcesService";
import { localPipelineResourceInput } from "@/services/projects/resourceDescriptor";
import type { ProjectResource } from "@/services/projects/types";
import { findRemotePipelineDocumentByPath } from "@/services/remotePipelineEditorService";
import { getRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { pipelineStorageDb } from "./db";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import * as pipelineAssociations from "./pipelineAssociations";
import { PipelineFile } from "./PipelineFile";
import { emitPipelineFileChanged } from "./pipelineFileEvents";
import {
  findPipelineMigration,
  PipelineMovedToBackendError,
} from "./pipelineMigrations";
import * as registry from "./pipelineRegistry";
import { PipelineStorageService } from "./PipelineStorageService";
import { getEditorPipelineIdentity } from "./types";

vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn(), put: vi.fn() },
}));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock("./pipelineFileEvents", () => ({ emitPipelineFileChanged: vi.fn() }));
vi.mock("./createDriver", () => ({
  createDriver: () => ({ hasKey: vi.fn().mockResolvedValue(false) }),
}));
vi.mock("@/services/remotePipelineEditorService", async (original) => ({
  ...(await original<
    typeof import("@/services/remotePipelineEditorService")
  >()),
  findRemotePipelineDocumentByPath: vi.fn(),
}));
vi.mock("./pipelineRegistry");
vi.mock("@/services/projects/projectResourcesService");
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
  vi.mocked(findRemotePipelineDocumentByPath).mockResolvedValue(undefined);
  await LibraryDB.favorites.clear();
  await pipelineStorageDb.pipeline_migrations.clear();
  await pipelineStorageDb.pipeline_migration_attempts.clear();
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
        file_path: String(options?.query?.file_path ?? saved.file_path),
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
    vi.mocked(client.put).mockResolvedValue(
      response({
        ...document,
        root_pipeline_task: {
          ...document.root_pipeline_task,
          componentRef: { spec: editedSpec },
        },
      }),
    );
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
    expect(componentSpecFromYaml(await file.read())).toEqual(editedSpec);
    expect(file.id).toBe(ref.pipelineId);
    expect(client.put).toHaveBeenCalledExactlyOnceWith({
      baseUrl: ref.backendUrl,
      url: "/api/pipelines/{pipeline_id}",
      path: { pipeline_id: ref.pipelineId },
      body: {
        root_pipeline_task: {
          ...document.root_pipeline_task,
          componentRef: { spec: editedSpec },
        },
        pipeline_run_annotations: document.pipeline_run_annotations,
      },
    });
    await file.write(content);
    await file.rename("Edited");
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(getCurrentUserApiUsersMeGet).toHaveBeenCalledExactlyOnceWith({
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
    "preserves reading while denying mutations without verified write access: %j",
    async (user) => {
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(user);
      const readOnly = await storage.resolvePipeline(ref);
      expect(readOnly.folder.driver.canEdit).toBe(false);
      expect(componentSpecFromYaml(await readOnly.read())).toEqual(spec);
      await expect(readOnly.write(content)).rejects.toThrow();
      await expect(readOnly.rename("Changed")).rejects.toThrow();
      expect(readOnly.storageKey).toBe("Original");
      expect(client.put).not.toHaveBeenCalled();
    },
  );

  it("exposes temporary permission lookup failures and rechecks on reopen", async () => {
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(
      response(undefined, 503),
    );
    const readOnly = await storage.resolvePipeline(ref);
    expect(readOnly.editingError?.message).toContain(
      "Unable to verify your editing permissions",
    );
    expect(componentSpecFromYaml(await readOnly.read())).toEqual(spec);

    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
    const reopened = await storage.resolvePipeline(ref);
    expect(reopened.editingError).toBeUndefined();
    expect(reopened.folder.driver.canEdit).toBe(true);
  });

  it.each([
    response({ ...owner, id: "other@example.com" }),
    response({ ...owner, permissions: ["read"] }),
    response(undefined, 403),
  ])(
    "does not report denied edit access as a lookup failure: %j",
    async (user) => {
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(user);
      const file = await storage.resolvePipeline(ref);
      expect(file.folder.driver.canEdit).toBe(false);
      expect(file.editingError).toBeUndefined();
    },
  );

  it("keeps the original document when the server refuses a stale editing capability", async () => {
    const file = await storage.resolvePipeline(ref);
    vi.mocked(client.put).mockResolvedValue(response(undefined, 403));
    await expect(file.write(content)).rejects.toThrow(
      "Failed to save pipeline (403)",
    );
    expect(componentSpecFromYaml(await file.read())).toEqual(spec);
    expect(getCurrentUserApiUsersMeGet).toHaveBeenCalledTimes(1);
  });

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
      await expect(file.rename("Edited")).rejects.toThrow(error);
      expect(componentSpecFromYaml(await file.read())).toEqual(spec);
      expect(file.storageKey).toBe("Original");
      expect(await file.folder.driver.hasKey("Original")).toBe(true);
    },
  );

  it("renames the latest queued edit across document instances and waits during reopen", async () => {
    const first = await storage.resolvePipeline(ref);
    const second = await storage.resolvePipeline(ref);
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let savedSpec = { ...spec, description: "Original description" };
    const serverResponse = () =>
      response({
        ...document,
        root_pipeline_task: { componentRef: { spec: savedSpec } },
      });
    vi.mocked(client.put)
      .mockImplementationOnce(async () => {
        await pending;
        savedSpec = { ...editedSpec, description: "Latest description" };
        return serverResponse();
      })
      .mockImplementationOnce(async (options) => {
        expect(options?.body).toMatchObject({
          root_pipeline_task: {
            componentRef: {
              spec: { name: "Latest", description: "Latest description" },
            },
          },
        });
        savedSpec = { ...savedSpec, name: "Latest" };
        return serverResponse();
      });
    const firstWrite = first.write(
      componentSpecToYaml({ ...editedSpec, description: "Latest description" }),
    );
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    vi.mocked(client.get).mockImplementation(async () => serverResponse());
    const reopening = storage.resolvePipeline(ref);
    const secondWrite = second.rename("Latest");
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
    expect(componentSpecFromYaml(await reopened.read()).description).toBe(
      "Latest description",
    );
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
    let filePath = document.file_path;
    vi.mocked(client.put).mockImplementation(async (options) => {
      filePath = String(options?.query?.file_path ?? filePath);
      return response({
        ...document,
        file_path: filePath,
        ...(options?.body as object),
      });
    });
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
    expect(paths().slice(1)).toEqual([undefined, undefined]);
    expect(client.put).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "/api/pipelines/{pipeline_id}",
        path: { pipeline_id: ref.pipelineId },
      }),
    );
    expect(paths()[0]).not.toBe("pipelines/draft-1.yaml");
    expect(file.id).toBe(ref.pipelineId);
    expect(file.initialId).toBe(draft.draftId);
    expect(file.storageKey).toBe("Edited");
    expect(file.isDraft).toBe(false);
    expect(componentSpecFromYaml(await file.read()).description).toBe("Third");
    await file.rename("Renamed after saving");
    expect(componentSpecFromYaml(await file.read())).toMatchObject({
      name: "Renamed after saving",
      description: "Third",
    });
    expect(client.put).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "/api/pipelines/{pipeline_id}",
        path: { pipeline_id: ref.pipelineId },
      }),
    );
    expect(registry.addEntry).not.toHaveBeenCalled();
    expect(registry.updateEntry).not.toHaveBeenCalled();
    storage.discardRemoteDraft(draft);
    expect(
      storage.getRemoteDraftRef(draft.draftId, ref.backendUrl),
    ).toMatchObject({
      source: "draft",
      draftId: draft.draftId,
    });
    const writesBeforeReopen = paths().length;
    const reopened = await storage.resolvePipeline(draft);
    expect(reopened.remote?.pipelineId).toBe(ref.pipelineId);
    expect(client.put).toHaveBeenCalledTimes(writesBeforeReopen);
  });

  it("recovers a saved draft alias after recreating the storage service", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    const restored = new PipelineStorageService();
    expect(
      restored.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toMatchObject({
      source: "draft",
      draftId: draft.draftId,
    });
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
      expect(paths()[0]).toEqual(expect.any(String));
      expect(paths()[1]).toBeUndefined();
      expect(client.put).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: "/api/pipelines/{pipeline_id}",
          path: { pipeline_id: ref.pipelineId },
        }),
      );
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
    const resolvePipeline = storage.resolvePipeline.bind(storage);
    vi.spyOn(storage, "resolvePipeline").mockImplementation((pipelineRef) =>
      "source" in pipelineRef
        ? resolvePipeline(pipelineRef)
        : Promise.resolve(local),
    );
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

  it("keeps the browser copy when manual Upload cannot establish project coverage", async () => {
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
        keepLocalCopy: true,
      }),
    ).resolves.toMatchObject({ id: ref.pipelineId });

    expect(client.put).toHaveBeenCalledOnce();
    expect(local.deleteFile).not.toHaveBeenCalled();
    expect(listProjectResources).not.toHaveBeenCalled();
    expect(createProjectResource).not.toHaveBeenCalled();
    expect(deleteProjectResource).not.toHaveBeenCalled();
    expect(
      await pipelineStorageDb.pipeline_migration_attempts.get(local.id),
    ).toMatchObject({
      keepLocalCopy: true,
      content,
    });
  });

  it("retains the browser copy after restart and retries without overwriting the upload", async () => {
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
        keepLocalCopy: true,
      }),
    ).resolves.toMatchObject({ id: ref.pipelineId });
    await pipelineStorageDb.pipeline_registry.put({
      id: local.id,
      storageKey: local.storageKey,
      folderId: local.folder.id,
    });
    pipelineStorageDb.close();
    await pipelineStorageDb.open();
    const reopened = new PipelineStorageService();
    const reopenedLocal = new PipelineFile({
      id: local.id,
      storageKey: local.storageKey,
      folder: reopened.rootFolder,
    });
    vi.spyOn(reopenedLocal, "read").mockResolvedValue(content);
    vi.spyOn(reopenedLocal, "deleteFile").mockResolvedValue();
    vi.mocked(client.get).mockResolvedValue(
      response({
        ...document,
        root_pipeline_task: {
          componentRef: { spec: { ...spec, description: "Edited remotely" } },
        },
      }),
    );

    const recovered = await migrateLocalPipelineOnOpen(
      reopened,
      reopenedLocal,
      { name: local.storageKey, fileId: local.id },
      ref.backendUrl,
    );

    expect(recovered.warning).toBeUndefined();
    expect(componentSpecFromYaml(await recovered.file.read()).description).toBe(
      "Edited remotely",
    );
    expect(reopenedLocal.deleteFile).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledOnce();
    expect(
      await pipelineStorageDb.pipeline_migration_attempts.get(local.id),
    ).toMatchObject({
      keepLocalCopy: true,
    });
  });

  it("repairs one known project without deleting the copy needed by undiscovered project links", async () => {
    const localResource: ProjectResource = {
      id: "local-resource",
      projectId: "known-project",
      name: local.storageKey,
      entityId: null,
      metadata: null,
      payload: null,
      createdBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      ...localPipelineResourceInput({
        localId: local.id,
        localName: local.storageKey,
      }),
    };
    const undiscovered = { ...localResource, projectId: "unlisted-project" };
    const resources = new Map([
      ["known-project", [localResource]],
      ["unlisted-project", [undiscovered]],
    ]);
    vi.mocked(listProjectResources).mockImplementation(async (projectId) => ({
      items: resources.get(projectId) ?? [],
      nextPageToken: null,
      totalCount: resources.get(projectId)?.length ?? 0,
    }));
    vi.mocked(createProjectResource).mockImplementation(
      async (projectId, input) => {
        const remoteResource: ProjectResource = {
          ...localResource,
          ...input,
          id: "remote-resource",
          projectId,
        };
        resources.get(projectId)!.push(remoteResource);
        return remoteResource;
      },
    );
    vi.mocked(deleteProjectResource).mockImplementation(
      async (projectId, resourceId) => {
        resources.set(
          projectId,
          resources.get(projectId)!.filter(({ id }) => id !== resourceId),
        );
      },
    );
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
        keepLocalCopy: true,
      }),
    ).resolves.toMatchObject({ id: ref.pipelineId });

    const recovered = await migrateLocalPipelineOnOpen(
      storage,
      local,
      { name: local.storageKey, fileId: local.id },
      ref.backendUrl,
      "known-project",
    );

    expect(recovered.warning).toBeUndefined();
    expect(resources.get("known-project")).toEqual([
      expect.objectContaining({ entity: "pipeline", entityId: ref.pipelineId }),
    ]);
    expect(resources.get("unlisted-project")).toEqual([undiscovered]);
    expect(listProjectResources).toHaveBeenCalledExactlyOnceWith(
      "known-project",
      expect.any(Object),
      ref.backendUrl,
    );
    expect(local.deleteFile).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledOnce();
  });

  it("recovers a lost upload response without overwriting remote edits", async () => {
    vi.mocked(client.put).mockRejectedValueOnce(new Error("Response lost"));
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow("Response lost");
    const recovered = {
      ...document,
      file_path: `pipelines/${local.id}.yaml`,
      root_pipeline_task: {
        componentRef: {
          spec: { ...spec, description: "Edited remotely after upload" },
        },
      },
    };
    vi.mocked(findRemotePipelineDocumentByPath).mockResolvedValue(recovered);
    vi.mocked(client.get).mockResolvedValue(response(recovered));
    const remote = await storage.moveLocalPipelineToRemote(
      local,
      ref.backendUrl,
    );
    expect(componentSpecFromYaml(await remote.read()).description).toBe(
      "Edited remotely after upload",
    );
    expect(client.put).toHaveBeenCalledOnce();
    expect(local.deleteFile).toHaveBeenCalledOnce();
  });

  it("keeps local edits made after an uncertain upload instead of deleting them", async () => {
    vi.mocked(client.put).mockRejectedValueOnce(new Error("Response lost"));
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow();
    vi.mocked(local.read).mockResolvedValue(
      componentSpecToYaml({ ...spec, description: "New local work" }),
    );
    vi.mocked(findRemotePipelineDocumentByPath).mockResolvedValue({
      ...document,
      file_path: `pipelines/${local.id}.yaml`,
    });
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toMatchObject({
      name: "PipelineMigrationRecoveryError",
      remote: expect.objectContaining({
        remote: expect.objectContaining({ pipelineId: ref.pipelineId }),
      }),
    });
    expect(local.deleteFile).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledOnce();
  });

  it.each([403, 404, 405, 422, 501])(
    "allows another backend after a rejected upload (%s)",
    async (status) => {
      vi.mocked(client.put).mockResolvedValueOnce(response(undefined, status));
      await expect(
        storage.moveLocalPipelineToRemote(local, ref.backendUrl),
      ).rejects.toThrow();
      expect(
        await pipelineStorageDb.pipeline_migration_attempts.get(local.id),
      ).toBeUndefined();
      await storage.moveLocalPipelineToRemote(
        local,
        "https://other.example.com",
      );
      expect(local.deleteFile).toHaveBeenCalledOnce();
    },
  );

  it("allows another backend when checking for an earlier upload failed before any PUT", async () => {
    vi.mocked(findRemotePipelineDocumentByPath).mockRejectedValueOnce(
      new Error("Lookup unavailable"),
    );
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow("Lookup unavailable");
    expect(client.put).not.toHaveBeenCalled();
    await storage.moveLocalPipelineToRemote(local, "https://other.example.com");
    expect(local.deleteFile).toHaveBeenCalledOnce();
  });

  it("describes an uncertain upload without claiming that the pipeline was moved", async () => {
    vi.mocked(client.put).mockRejectedValueOnce(new Error("Response lost"));
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow();
    await expect(
      storage.moveLocalPipelineToRemote(local, "https://other.example.com"),
    ).rejects.toThrow("may have completed");
    expect(client.put).toHaveBeenCalledOnce();
    expect(local.deleteFile).not.toHaveBeenCalled();
  });

  it("keeps edits written while saved links are being moved", async () => {
    vi.spyOn(
      pipelineAssociations,
      "movePipelineAssociationsToRemote",
    ).mockImplementationOnce(async () => {
      vi.mocked(local.read).mockResolvedValue(
        componentSpecToYaml({ ...spec, description: "Other tab edit" }),
      );
    });
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow("local changes were not uploaded");
    expect(local.deleteFile).not.toHaveBeenCalled();
  });

  it("uploads the latest local edits if a previous failed attempt saved nothing", async () => {
    vi.mocked(client.put).mockRejectedValueOnce(new Error("Offline"));
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow();
    vi.mocked(local.read).mockResolvedValue(
      componentSpecToYaml({ ...spec, description: "New local work" }),
    );
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl);
    expect(vi.mocked(client.put).mock.lastCall?.[0]?.body).toMatchObject({
      root_pipeline_task: {
        componentRef: { spec: { description: "New local work" } },
      },
    });
    expect(local.deleteFile).toHaveBeenCalledOnce();
  });

  it("serializes two callers and repairs both projects without uploading twice", async () => {
    const firstRepair = vi.fn();
    const secondRepair = vi.fn();
    await Promise.all([
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, firstRepair),
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, secondRepair),
    ]);
    expect(client.put).toHaveBeenCalledOnce();
    expect(local.deleteFile).toHaveBeenCalledOnce();
    expect(firstRepair).toHaveBeenCalledOnce();
    expect(secondRepair).toHaveBeenCalledOnce();
  });

  it("assigns a fresh identity to a raw file recreated after migration", async () => {
    await pipelineStorageDb.pipeline_migrations.put({
      key: "name:Original",
      localId: "old-id",
      remote: ref,
      name: "Original",
    });
    await storage.rootFolder.assignFile("Original");
    expect(registry.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: "Original",
      }),
    );
  });

  it("refuses a recreated local file rather than replacing a previous name alias", async () => {
    await pipelineStorageDb.pipeline_migrations.put({
      key: "name:Original",
      localId: "old-id",
      remote: ref,
      name: "Original",
    });
    vi.mocked(registry.findById).mockResolvedValue({
      id: local.id,
      storageKey: "Original",
      folderId: "folder",
    });
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl),
    ).rejects.toThrow("recreated a local copy");
    expect(client.put).not.toHaveBeenCalled();
    expect(local.deleteFile).not.toHaveBeenCalled();
    expect((await findPipelineMigration({ name: "Original" }))?.localId).toBe(
      "old-id",
    );
  });

  it("retries a retained upload after the saved remote pipeline was deleted", async () => {
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
      keepLocalCopy: true,
    });
    vi.mocked(client.get).mockImplementation(async (options) =>
      options?.url === "/api/pipelines/{pipeline_id}"
        ? response(undefined, 404)
        : response({ items: [], total_count: 0 }),
    );
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
        keepLocalCopy: true,
      }),
    ).resolves.toMatchObject({ id: ref.pipelineId });
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(local.deleteFile).not.toHaveBeenCalled();
  });

  it("reuses the remote document found at the migration path after its old ID is missing", async () => {
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
      keepLocalCopy: true,
    });
    const recovered = {
      ...document,
      id: "recovered-at-migration-path",
      file_path: `pipelines/${local.id}.yaml`,
    };
    vi.mocked(findRemotePipelineDocumentByPath).mockResolvedValue(recovered);
    vi.mocked(client.get).mockImplementation(async (options) =>
      options?.path?.pipeline_id === ref.pipelineId
        ? response(undefined, 404)
        : response(recovered),
    );
    await expect(
      storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
        keepLocalCopy: true,
      }),
    ).resolves.toMatchObject({ id: recovered.id });
    expect(
      (
        await findPipelineMigration({
          fileId: local.id,
          name: local.storageKey,
        })
      )?.remote.pipelineId,
    ).toBe(recovered.id);
    expect(client.put).toHaveBeenCalledOnce();
    expect(local.deleteFile).not.toHaveBeenCalled();
  });

  it("accepts equivalent backend spellings on a retained upload retry", async () => {
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl, undefined, {
      keepLocalCopy: true,
    });
    await expect(
      storage.moveLocalPipelineToRemote(
        local,
        "https://BACKEND.example.com:443/",
        undefined,
        { keepLocalCopy: true },
      ),
    ).resolves.toMatchObject({ id: ref.pipelineId });
    expect(client.put).toHaveBeenCalledOnce();
  });

  it("reports a queued backend switch as already moved after the first caller removes the local file", async () => {
    const first = storage.moveLocalPipelineToRemote(local, ref.backendUrl);
    const second = storage.moveLocalPipelineToRemote(
      local,
      "https://other.example.com",
    );
    await first;
    await expect(second).rejects.toBeInstanceOf(PipelineMovedToBackendError);
    expect(local.deleteFile).toHaveBeenCalledOnce();
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
    const onCreated = vi.fn();
    await expect(
      storage.moveLocalPipelineToRemote(
        local,
        "https://other.example.com",
        onCreated,
      ),
    ).rejects.toThrow(
      `This pipeline was moved to ${ref.backendUrl}. Select that backend in Settings to open it.`,
    );
    expect(client.get).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(local.deleteFile).not.toHaveBeenCalled();

    const remote = await storage.moveLocalPipelineToRemote(
      local,
      ref.backendUrl,
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

  it("rejects an already migrated file from another backend before updating links", async () => {
    const remote = await storage.moveLocalPipelineToRemote(
      local,
      ref.backendUrl,
    );
    const onCreated = vi.fn();

    await expect(
      storage.moveLocalPipelineToRemote(
        remote,
        "https://other.example.com",
        onCreated,
      ),
    ).rejects.toThrow("Select that backend in Settings");
    expect(onCreated).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledOnce();
    expect(local.deleteFile).toHaveBeenCalledOnce();
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

  it("keeps earlier ID links when a recreated copy is deliberately renamed and migrated", async () => {
    await storage.moveLocalPipelineToRemote(local, ref.backendUrl);
    const namesake = new PipelineFile({
      id: "new-local-id",
      storageKey: "Renamed copy",
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
      (await findPipelineMigration({ name: namesake.storageKey }))?.remote
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

describe("saved draft history safety", () => {
  beforeEach(() => {
    let filePath = document.file_path;
    vi.mocked(client.put).mockImplementation(async (options) => {
      filePath = String(options?.query?.file_path ?? filePath);
      return response({
        ...document,
        file_path: filePath,
        ...(options?.body as object),
      });
    });
  });
  const draft = {
    source: "draft",
    backendUrl: ref.backendUrl,
    draftId: "history-draft",
    name: "History",
  } as const;
  it.each([
    ["malformed JSON", "{"],
    ["missing owner", JSON.stringify({ remote: ref })],
    [
      "blank pipeline ID",
      JSON.stringify({
        remote: { ...ref, pipelineId: " " },
        ownerId: owner.id,
      }),
    ],
    [
      "another backend",
      JSON.stringify({
        remote: { ...ref, backendUrl: "https://other.example.com" },
        ownerId: owner.id,
      }),
    ],
  ])("ignores a saved draft alias with %s", (_label, value) => {
    sessionStorage.setItem(
      `saved-draft:${getEditorPipelineIdentity(draft)}`,
      value,
    );
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
    expect(client.get).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
  it("does not reopen another account's saved draft or overwrite its retained contents", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(
      response({ ...owner, id: "other@example.com" }),
    );
    await expect(storage.resolvePipeline(draft)).rejects.toThrow(
      "another account",
    );
    const restored = new PipelineStorageService();
    await expect(restored.resolvePipeline(draft)).rejects.toThrow(
      "another account",
    );
    expect(client.put).toHaveBeenCalledOnce();
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
    await expect(restored.resolvePipeline(draft)).resolves.toMatchObject({
      remote: { pipelineId: ref.pipelineId },
    });
  });
  it("remembers that a history alias is unavailable after a missing saved pipeline", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    const restored = new PipelineStorageService();
    vi.mocked(client.get).mockResolvedValue(response(undefined, 404));
    await expect(restored.resolvePipeline(draft)).rejects.toThrow("404");
    vi.mocked(client.get).mockClear();
    await expect(
      new PipelineStorageService().resolvePipeline(draft),
    ).rejects.toThrow("no longer available");
    expect(client.get).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledOnce();
  });
  it("retains the saved alias after a temporary backend error", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    const restored = new PipelineStorageService();
    vi.mocked(client.get).mockResolvedValueOnce(response(undefined, 503));
    await expect(restored.resolvePipeline(draft)).rejects.toThrow("503");
    await expect(restored.resolvePipeline(draft)).resolves.toMatchObject({
      remote: { pipelineId: ref.pipelineId },
    });
  });
});
