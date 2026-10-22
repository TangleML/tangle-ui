import { isRootStore } from "mobx-keystone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { hydrateLoadedSpecRefs } from "@/routes/v2/pages/Editor/utils/hydrateSpecRefs";
import type { SavedPipelineDocument } from "@/services/pipelineSpecService";
import { findRemotePipelineDocumentByPath } from "@/services/remotePipelineEditorService";

import { PipelineFile } from "./PipelineFile";
import { PipelineStorageService } from "./PipelineStorageService";
import { withRemotePipelineDeletion } from "./remotePipelineDeletion";
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));
vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn(), put: vi.fn() },
}));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock("@/services/remotePipelineEditorService", async (original) => ({
  ...(await original<
    typeof import("@/services/remotePipelineEditorService")
  >()),
  findRemotePipelineDocumentByPath: vi.fn(),
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
const content = editedSpec;
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
  localStorage.clear();
  sessionStorage.clear();
  storage = new PipelineStorageService();
  vi.mocked(client.get).mockResolvedValue(response(structuredClone(document)));
  vi.mocked(client.put).mockResolvedValue(response(document));
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
});
afterEach(() => vi.useRealTimers());
describe("PipelineStorageService editor resolution", () => {
  it("disposes a document whose last owner leaves while hydration is pending", async () => {
    const hydration = Promise.withResolvers<void>();
    vi.mocked(hydrateLoadedSpecRefs).mockReturnValueOnce(hydration.promise);
    const release = storage.retainDocument(ref);
    const loading = storage.loadDocument(ref);
    await vi.waitFor(() =>
      expect(hydrateLoadedSpecRefs).toHaveBeenCalledOnce(),
    );
    release();
    await Promise.resolve();
    expect(storage.getFile(ref)).toBeDefined();
    hydration.resolve();
    const loaded = await loading;
    expect(storage.getFile(ref)).toBeUndefined();
    expect(isRootStore(loaded.spec)).toBe(false);
    const write = vi.spyOn(loaded.file, "write");
    vi.useFakeTimers();
    loaded.spec.setDescription("Closed document");
    await vi.runAllTimersAsync();
    expect(write).not.toHaveBeenCalled();
  });
  it("keeps ownership through a failed load retry", async () => {
    const release = storage.retainDocument(ref);
    vi.mocked(client.get).mockRejectedValueOnce(new Error("Unavailable"));
    await expect(storage.loadDocument(ref)).rejects.toThrow();
    storage.retryDocument(ref);
    const loaded = await storage.loadDocument(ref);
    expect(storage.getFile(ref)).toBe(loaded.file);
    release();
    await Promise.resolve();
    expect(storage.getFile(ref)).toBeUndefined();
    expect(isRootStore(loaded.spec)).toBe(false);
  });
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
      editorSpec,
    );
    expect(saved.root_pipeline_task.arguments).toEqual({ name: "" });
    expect(await file.read()).toEqual(editorSpec);
    vi.mocked(client.get).mockImplementation(async () => response(saved));
    const reopened = await storage.resolvePipeline(ref);
    const loaded = await reopened.read();
    expect(loaded).toEqual(editorSpec);
    loaded.inputs![0].value = "Ada";
    await reopened.write(loaded);
    expect(saved.root_pipeline_task.arguments).toEqual({ name: "Ada" });
    expect(await reopened.read()).toEqual(loaded);
    delete loaded.inputs![0].value;
    await reopened.write(loaded);
    expect(saved.root_pipeline_task.arguments).toEqual({});
    expect(await reopened.read()).toEqual(loaded);
  });
  it("reads and edits the owned remote document", async () => {
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
    expect(await file.read()).toEqual(spec);
    expect(file.id).toBe(ref.pipelineId);
    expect(file.remote).toEqual({
      backendUrl: ref.backendUrl,
      pipelineId: ref.pipelineId,
    });
    expect(file.canEdit).toBe(true);
    await file.write(editedSpec);
    expect(file.name).toBe("Edited");
    expect(await file.read()).toEqual(editedSpec);
    expect(file.id).toBe(ref.pipelineId);
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
    await file.write(content);
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(getCurrentUserApiUsersMeGet).toHaveBeenLastCalledWith({
      baseUrl: ref.backendUrl,
    });
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
      expect(readOnly.canEdit).toBe(false);
      expect(await readOnly.read()).toEqual(spec);
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
      const owned = await storage.resolvePipeline(ref);
      vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(user);
      for (const file of [readOnly, owned]) {
        await expect(file.write(content)).rejects.toThrow();
        await expect(
          file.write({ ...spec, name: "Changed" }),
        ).rejects.toThrow();
        expect(file.name).toBe("Original");
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
      await expect(file.write(editedSpec)).rejects.toThrow(error);
      expect(await file.read()).toEqual(spec);
      expect(file.name).toBe("Original");
    },
  );
  it("serializes edits on the same retained document", async () => {
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
    const firstWrite = first.write({
      ...editedSpec,
      description: "Latest description",
    });
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    vi.mocked(client.get).mockImplementation(async () => serverResponse());
    const reopening = storage.resolvePipeline(ref);
    const secondWrite = second.write({
      ...editedSpec,
      description: "Latest description",
      name: "Latest",
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(client.put).toHaveBeenCalledTimes(1);
      expect(client.get).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
    const [, , reopened] = await Promise.all([
      firstWrite,
      secondWrite,
      reopening,
    ]);
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(reopened).toBe(first);
    expect(second).toBe(first);
    expect((await reopened.read()).name).toBe("Latest");
    expect((await reopened.read()).description).toBe("Latest description");
  });
  it("gives same-name copies distinct remote identities", async () => {
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
    expect(first.canEdit).toBe(true);
    expect((await first.read()).name).toBe("Copy");
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
      expect(copy.canEdit).toBe(true);
      expect(client.put).toHaveBeenCalledExactlyOnceWith({
        baseUrl: ref.backendUrl,
        url: "/api/users/me/pipelines",
        query: { file_path: expect.not.stringContaining("original") },
        body: {
          root_pipeline_task: copiedTask,
          pipeline_run_annotations: sourceDocument.pipeline_run_annotations,
        },
      });
      expect(await source.read()).toEqual(spec);
      expect(await copy.read()).toEqual({
        ...editedSpec,
        name: "Copy",
      });
    },
  );
  it("propagates remote errors", async () => {
    vi.mocked(client.get).mockRejectedValue(new Error("Remote unavailable"));
    await expect(storage.resolvePipeline(ref)).rejects.toMatchObject({
      kind: "unavailable",
      status: 0,
    });
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
    const first = storage.retainDocument(draft);
    const second = storage.retainDocument(draft);
    storage.discardRemoteDraft(draft);
    expect(storage.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toBe(
      draft,
    );
    expect(storage.getFile(draft)).toBe(file);
    first();
    first();
    await Promise.resolve();
    expect(storage.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toBe(
      draft,
    );
    second();
    await Promise.resolve();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });
  it("survives an ownership reconnect and waits for the reopened editor to save", async () => {
    const file = await storage.resolvePipeline(draft);
    const first = storage.retainDocument(draft);
    storage.discardRemoteDraft(draft);
    first();
    const second = storage.retainDocument(draft);
    await Promise.resolve();
    expect(await storage.resolvePipeline(draft)).toBe(file);
    second();
    await Promise.resolve();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });
  it("keeps drafts in memory, then serializes edits into one remote record", async () => {
    const file = await storage.resolvePipeline(draft);
    expect(await storage.resolvePipeline(draft)).toBe(file);
    expect((await file.read()).name).toBe(draft.name);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
    expect(getCurrentUserApiUsersMeGet).not.toHaveBeenCalled();
    const first = file.write(content);
    const second = file.write({ ...editedSpec, description: "Second" });
    await first;
    const third = file.write({ ...editedSpec, description: "Third" });
    await Promise.all([second, third]);
    expect(new Set(paths()).size).toBe(1);
    expect(paths()[0]).not.toBe("pipelines/draft-1.yaml");
    expect(file.id).toBe(ref.pipelineId);
    expect(file.initialId).toBe(draft.draftId);
    expect(file.name).toBe("Edited");
    expect(file.isDraft).toBe(false);
    expect((await file.read()).description).toBe("Third");
    await file.write({ ...file.read(), name: "Renamed after saving" });
    expect(await file.read()).toMatchObject({
      name: "Renamed after saving",
      description: "Third",
    });
    expect(paths().at(-1)).toBe(paths()[0]);
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
  it("waits for every admitted draft edit before reopening the promoted server identity", async () => {
    const file = await storage.resolvePipeline(draft);
    const pending = Promise.withResolvers<void>();
    let puts = 0;
    vi.mocked(client.put).mockImplementation(async (options) => {
      if (++puts === 2) await pending.promise;
      return response({
        ...document,
        file_path: String(options?.query?.file_path),
        ...(options?.body as object),
      });
    });
    const first = file.write(content);
    const second = file.write({ ...content, description: "Queued edit" });
    await first;
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(2));
    const opening = PipelineFile.open(ref);
    await Promise.resolve();
    expect(client.get).not.toHaveBeenCalled();
    pending.resolve();
    await second;
    await opening;
    expect(client.get).toHaveBeenCalledOnce();
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
  it("copies a promoted draft with its retained metadata", async () => {
    const file = await storage.resolvePipeline(draft);
    await file.write(content);
    const copy = await storage.copyRemotePipeline(
      file,
      "Copied draft",
      content,
    );
    expect(copy.remote).toBeDefined();
    expect(new Set(paths()).size).toBe(2);
    expect((await copy.read()).name).toBe("Copied draft");
  });
  it("allocates a fresh server path if an abandoned draft is recreated", async () => {
    const first = storage.createRemoteDraft(draft);
    await first.write(content);
    const second = storage.createRemoteDraft(draft);
    await second.write(content);
    expect(new Set(paths()).size).toBe(2);
  });
  it("blocks reopening a draft whose lost creation response is being deleted", async () => {
    const file = await storage.resolvePipeline(draft);
    vi.mocked(client.put).mockRejectedValueOnce(new Error("Response lost"));
    await expect(file.write(content)).rejects.toMatchObject({
      kind: "unavailable",
      status: 0,
    });
    expect(file.remote).toBeUndefined();
    const removal = Promise.withResolvers<void>();
    const deleting = withRemotePipelineDeletion(
      { ...ref, pipelineId: "unacknowledged-draft" },
      String(paths()[0]),
      () => removal.promise,
    );
    const failed = expect(deleting).rejects.toThrow("Delete refused");
    try {
      await expect(storage.resolvePipeline(draft)).rejects.toThrow(
        "being deleted",
      );
    } finally {
      removal.reject(new Error("Delete refused"));
      await failed;
    }
    await expect(storage.resolvePipeline(draft)).resolves.toBe(file);
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
      const file = storage.createRemoteDraft(
        { ...draft, name: "Project", provisionalName: true },
        attach,
      );
      expect(file.isDraft).toBe(true);
      expect(attach).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      if (fail) {
        await expect(file.write(content)).rejects.toThrow(
          "Pipeline saved, but it could not be attached",
        );
        expect(file.isDraft).toBe(false);
        expect(file.remote?.pipelineId).toBe(ref.pipelineId);
      }
      await file.write(content);
      await file.write(content);
      expect(file.remote?.pipelineId).toBe(ref.pipelineId);
      expect(attach).toHaveBeenCalledTimes(fail ? 2 : 1);
      expect(client.put).toHaveBeenCalledTimes(2);
      expect(attach).toHaveBeenLastCalledWith(ref);
      expect(new Set(paths()).size).toBe(1);
    },
  );
});
describe("saved draft history safety", () => {
  beforeEach(() => {
    vi.mocked(client.put).mockImplementation(async (options) =>
      response({
        ...document,
        file_path: String(options?.query?.file_path),
        ...(options?.body as object),
      }),
    );
  });
  const draft = {
    source: "draft",
    backendUrl: ref.backendUrl,
    draftId: "history-draft",
    name: "History",
  } as const;
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
