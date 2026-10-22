import { beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
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
