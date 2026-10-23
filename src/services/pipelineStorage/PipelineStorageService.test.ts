import { beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import type { SavedPipelineDocument } from "@/services/pipelineSpecService";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { PipelineFile } from "./PipelineFile";
import { emitPipelineFileChanged } from "./pipelineFileEvents";
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

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  storage = new PipelineStorageService();
  vi.mocked(client.get).mockResolvedValue(response(structuredClone(document)));
  vi.mocked(client.put).mockResolvedValue(response(document));
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
});

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
    finishSave();
    const remote = await moving;
    expect(storage.resolvePipeline).toHaveBeenCalledWith({ name: "Original" });
    expect(componentSpecFromYaml(await remote.read())).toEqual({
      ...editedSpec,
      name: "Original",
    });
    expect(local.deleteFile).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(["read", "save"])(
    "keeps the local pipeline when %s fails",
    async (step) => {
      const error = new Error("Unavailable");
      if (step === "read") vi.mocked(local.read).mockRejectedValue(error);
      else vi.mocked(client.put).mockRejectedValue(error);
      await expect(
        storage.moveLocalPipelineToRemote("Original", ref.backendUrl),
      ).rejects.toThrow("Unavailable");
      expect(local.deleteFile).not.toHaveBeenCalled();
    },
  );

  it("reports that the remote copy exists if local removal fails", async () => {
    vi.mocked(local.deleteFile).mockRejectedValue(
      new Error("Storage unavailable"),
    );
    await expect(
      storage.moveLocalPipelineToRemote("Original", ref.backendUrl),
    ).rejects.toThrow(
      "Pipeline was uploaded, but the copy in this browser could not be removed.",
    );
    expect(client.put).toHaveBeenCalledTimes(1);
  });
});
