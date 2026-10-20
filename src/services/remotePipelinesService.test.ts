import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { RemotePipelineDraftStorageDriver } from "@/services/pipelineStorage/drivers/RemotePipelineDraftStorageDriver";
import { RemotePipelineStorageDriver } from "@/services/pipelineStorage/drivers/RemotePipelineStorageDriver";
import { componentSpecToYaml } from "@/utils/yaml";

import {
  deleteRemotePipeline,
  listRemotePipelines,
  type RemotePipeline,
  type RemotePipelineFilters,
  remotePipelineFiltersToQuery,
} from "./remotePipelinesService";

vi.mock("@/api/client.gen", () => ({
  client: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));

const BACKEND_URL = "https://backend.example.com";

const pipeline: RemotePipeline = {
  id: "pipeline-1",
  user_id: "user@example.com",
  pipeline_name: "Example pipeline",
  file_path: "pipelines/example.yaml",
  created_at: "2026-09-22T17:26:29Z",
  updated_at: "2026-09-23T17:26:29Z",
  current_version: "version-1",
  versioning_mode: "full",
};

function response<T>(data: T, status = 200) {
  return {
    data,
    error: undefined,
    request: new Request(BACKEND_URL),
    response: new Response(null, { status }),
  };
}

function mockResponse<T>(data: T, status = 200) {
  vi.mocked(client.post).mockResolvedValue(response(data, status));
}

afterEach(() => vi.resetAllMocks());

describe("listRemotePipelines", () => {
  it("requests ten pipelines for the first page", async () => {
    mockResponse({ pipelines: [], next_page_token: null });

    await expect(listRemotePipelines(BACKEND_URL)).resolves.toEqual({
      pipelines: [],
      nextPageToken: null,
    });

    expect(client.post).toHaveBeenCalledExactlyOnceWith({
      client,
      headers: { "Content-Type": "application/json" },
      baseUrl: BACKEND_URL,
      url: "/api/pipelines/search",
      body: { page_size: 10, page_token: undefined },
    });
  });

  it("preserves the continuation token without requiring a total or fetching more pages", async () => {
    mockResponse({
      pipelines: [pipeline],
      next_page_token: "page-2",
    });

    await expect(listRemotePipelines(BACKEND_URL)).resolves.toEqual({
      pipelines: [pipeline],
      nextPageToken: "page-2",
    });

    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it("ignores a total count from older responses", async () => {
    mockResponse({
      pipelines: [pipeline],
      total_count: 50,
      next_page_token: "page-2",
    });
    expect(await listRemotePipelines(BACKEND_URL)).toEqual({
      pipelines: [pipeline],
      nextPageToken: "page-2",
    });
  });

  it("requests ten more pipelines with the supplied continuation token", async () => {
    mockResponse({
      pipelines: [pipeline],
      next_page_token: null,
    });

    await expect(listRemotePipelines(BACKEND_URL, "page-2")).resolves.toEqual({
      pipelines: [pipeline],
      nextPageToken: null,
    });

    expect(client.post).toHaveBeenCalledExactlyOnceWith({
      client,
      headers: { "Content-Type": "application/json" },
      baseUrl: BACKEND_URL,
      url: "/api/pipelines/search",
      body: { page_size: 10, page_token: "page-2" },
    });
  });

  it.each([undefined, "filtered-page-2"])(
    "includes the filter query with page token %s",
    async (pageToken) => {
      mockResponse({ pipelines: [], next_page_token: null });
      const filterQuery = remotePipelineFiltersToQuery({ user: "me" });

      await listRemotePipelines(BACKEND_URL, pageToken, filterQuery);

      expect(client.post).toHaveBeenCalledExactlyOnceWith({
        client,
        headers: { "Content-Type": "application/json" },
        baseUrl: BACKEND_URL,
        url: "/api/pipelines/search",
        body: {
          page_size: 10,
          page_token: pageToken,
          filter_query: filterQuery,
        },
      });
    },
  );

  it("normalizes an omitted continuation token to null", async () => {
    mockResponse({ pipelines: [pipeline] });

    await expect(listRemotePipelines(BACKEND_URL)).resolves.toEqual({
      pipelines: [pipeline],
      nextPageToken: null,
    });
  });

  it("rejects with a clear error when the API returns no data", async () => {
    mockResponse(undefined, 503);

    await expect(listRemotePipelines(BACKEND_URL)).rejects.toThrow(
      "Failed to load pipelines (503)",
    );
  });
});

describe("deleteRemotePipeline", () => {
  const owner = { id: pipeline.user_id, permissions: ["read", "write"] };
  const spec = { name: "Edited", implementation: { graph: { tasks: {} } } };
  const document = {
    ...pipeline,
    pipeline_run_annotations: {},
    root_pipeline_task: { componentRef: { spec } },
  };

  function createDraft(onCreated: () => Promise<void> = async () => {}) {
    return new RemotePipelineDraftStorageDriver(
      {
        source: "draft",
        backendUrl: BACKEND_URL,
        draftId: "draft-1",
        name: spec.name,
      },
      pipeline.file_path,
      (content) =>
        RemotePipelineStorageDriver.create(
          BACKEND_URL,
          spec.name,
          content,
          pipeline.file_path,
        ),
      onCreated,
    );
  }

  beforeEach(() => {
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(response(owner));
    vi.mocked(client.delete).mockResolvedValue(response(undefined, 204));
  });

  it("deletes the saved file path on the selected backend and accepts an empty 204", async () => {
    await expect(
      deleteRemotePipeline(BACKEND_URL, pipeline),
    ).resolves.toBeUndefined();

    expect(getCurrentUserApiUsersMeGet).toHaveBeenCalledExactlyOnceWith({
      baseUrl: BACKEND_URL,
    });
    expect(client.delete).toHaveBeenCalledExactlyOnceWith({
      client,
      baseUrl: BACKEND_URL,
      url: "/api/users/me/pipelines",
      query: { file_path: "pipelines/example.yaml" },
    });
    expect(client.get).not.toHaveBeenCalled();
  });

  it("refuses another owner's pipeline even when the caller has write access", async () => {
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(
      response({ ...owner, id: "other@example.com" }),
    );

    await expect(deleteRemotePipeline(BACKEND_URL, pipeline)).rejects.toThrow(
      "You can only delete pipelines that you own.",
    );
    expect(client.delete).not.toHaveBeenCalled();
  });

  it("refuses an owner without write permission", async () => {
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(
      response({ ...owner, permissions: ["read"] }),
    );

    await expect(deleteRemotePipeline(BACKEND_URL, pipeline)).rejects.toThrow(
      "You do not have permission",
    );
    expect(client.delete).not.toHaveBeenCalled();
  });

  it("refuses deletion when permissions cannot be verified", async () => {
    vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue(
      response(undefined, 503),
    );

    await expect(deleteRemotePipeline(BACKEND_URL, pipeline)).rejects.toThrow(
      "Unable to verify your editing permissions (503)",
    );
    expect(client.delete).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])(
    "reports a failed deletion with HTTP %s",
    async (status) => {
      vi.mocked(client.delete).mockResolvedValue(response(undefined, status));

      await expect(deleteRemotePipeline(BACKEND_URL, pipeline)).rejects.toThrow(
        `Failed to delete pipeline (${status})`,
      );
    },
  );

  it("propagates a connection failure", async () => {
    const error = new Error("Connection failed");
    vi.mocked(client.delete).mockRejectedValue(error);

    await expect(deleteRemotePipeline(BACKEND_URL, pipeline)).rejects.toBe(
      error,
    );
  });

  it("waits for an in-flight editor save before checking ownership and deleting", async () => {
    vi.mocked(client.get).mockResolvedValue(response(document));
    const driver = await RemotePipelineStorageDriver.open({
      source: "remote",
      backendUrl: BACKEND_URL,
      pipelineId: pipeline.id,
    });
    const pendingSave =
      Promise.withResolvers<ReturnType<typeof response<typeof document>>>();
    vi.mocked(client.put).mockReturnValue(pendingSave.promise);
    const saving = driver.write("Edited", componentSpecToYaml(spec));
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledOnce());
    vi.mocked(getCurrentUserApiUsersMeGet).mockClear();
    const deleting = deleteRemotePipeline(BACKEND_URL, pipeline);

    try {
      await Promise.resolve();
      expect(getCurrentUserApiUsersMeGet).not.toHaveBeenCalled();
      expect(client.delete).not.toHaveBeenCalled();
    } finally {
      pendingSave.resolve(response(document));
    }
    await Promise.all([saving, deleting]);
    expect(client.delete).toHaveBeenCalledOnce();
  });

  it.each(["creation response", "project attachment"])(
    "waits for a draft's %s and every queued edit before deleting",
    async (blockedPhase) => {
      const pendingCreation = Promise.withResolvers<void>();
      const pendingAttachment = Promise.withResolvers<void>();
      vi.mocked(client.put).mockImplementation(async () => {
        await pendingCreation.promise;
        return response(document);
      });
      const attach = vi.fn(() => pendingAttachment.promise);
      const draft = createDraft(attach);
      if (blockedPhase === "project attachment") pendingCreation.resolve();
      else pendingAttachment.resolve();

      const firstSave = draft.write(spec.name, componentSpecToYaml(spec));
      await vi.waitFor(() => expect(client.put).toHaveBeenCalledOnce());
      if (blockedPhase === "project attachment") {
        await vi.waitFor(() => expect(attach).toHaveBeenCalledOnce());
      }
      const nextSave = draft.write(
        spec.name,
        componentSpecToYaml({ ...spec, description: "Latest edit" }),
      );
      const rename = draft.rename(spec.name, "Renamed");
      const deleting = deleteRemotePipeline(BACKEND_URL, pipeline);

      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(client.delete).not.toHaveBeenCalled();
      } finally {
        pendingCreation.resolve();
        pendingAttachment.resolve();
        await Promise.all([firstSave, nextSave, rename, deleting]);
      }
      expect(client.put).toHaveBeenCalledTimes(3);
      expect(client.delete).toHaveBeenCalledOnce();
      expect(
        vi.mocked(client.delete).mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        Math.max(...vi.mocked(client.put).mock.invocationCallOrder),
      );
    },
  );

  it("allows deletion after a draft's attachment fails", async () => {
    vi.mocked(client.put).mockResolvedValue(response(document));
    const draft = createDraft(async () => {
      throw new Error("Attachment failed");
    });
    await expect(
      draft.write(spec.name, componentSpecToYaml(spec)),
    ).rejects.toThrow("Attachment failed");

    await expect(
      deleteRemotePipeline(BACKEND_URL, pipeline),
    ).resolves.toBeUndefined();
    expect(client.delete).toHaveBeenCalledOnce();
  });

  it.each([
    { backendUrl: "https://other.example.com", filePath: pipeline.file_path },
    { backendUrl: BACKEND_URL, filePath: "pipelines/other.yaml" },
  ])(
    "does not wait for unrelated draft writes: %o",
    async ({ backendUrl, filePath }) => {
      const pendingCreation = Promise.withResolvers<void>();
      vi.mocked(client.put).mockImplementation(async () => {
        await pendingCreation.promise;
        return response(document);
      });
      const draft = createDraft();
      const saving = draft.write(spec.name, componentSpecToYaml(spec));
      await vi.waitFor(() => expect(client.put).toHaveBeenCalledOnce());

      try {
        await deleteRemotePipeline(backendUrl, {
          ...pipeline,
          file_path: filePath,
        });
        expect(client.delete).toHaveBeenCalledOnce();
      } finally {
        pendingCreation.resolve();
        await saving;
      }
    },
  );
});

describe("remotePipelineFiltersToQuery", () => {
  it("combines all five filter controls using the search API fields", () => {
    const filters = {
      name: 'A "quoted" pipeline \\ path',
      id: "00000000-0000-4000-8000-000000000001",
      user: "me",
      createdAfter: "2026-09-01T04:00:00.000Z",
      createdBefore: "2026-10-01T04:00:00.000Z",
      updatedAfter: "2026-10-01T04:00:00.000Z",
      updatedBefore: "2026-10-15T04:00:00.000Z",
    };

    expect(remotePipelineFiltersToQuery(filters)).toBe(
      JSON.stringify({
        and: [
          {
            value_contains: {
              key: "system/pipeline.name",
              value_substring: filters.name,
            },
          },
          {
            value_equals: { key: "system/pipeline.id", value: filters.id },
          },
          {
            value_equals: { key: "system/pipeline.user_id", value: "me" },
          },
          {
            time_range: {
              key: "system/pipeline.date.created_at",
              start_time: filters.createdAfter,
              end_time: filters.createdBefore,
            },
          },
          {
            time_range: {
              key: "system/pipeline.date.updated_at",
              start_time: filters.updatedAfter,
              end_time: filters.updatedBefore,
            },
          },
        ],
      }),
    );
  });

  it("omits absent and empty date bounds", () => {
    expect(
      remotePipelineFiltersToQuery({
        createdAfter: "2026-09-01T00:00:00.000Z",
        createdBefore: "",
        updatedBefore: "2026-10-15T00:00:00.000Z",
      }),
    ).toBe(
      JSON.stringify({
        and: [
          {
            time_range: {
              key: "system/pipeline.date.created_at",
              start_time: "2026-09-01T00:00:00.000Z",
            },
          },
          {
            time_range: {
              key: "system/pipeline.date.updated_at",
              end_time: "2026-10-15T00:00:00.000Z",
            },
          },
        ],
      }),
    );
  });

  it.each<RemotePipelineFilters>([
    {},
    {
      name: "",
      id: "",
      user: "",
      createdAfter: "",
      createdBefore: "",
      updatedAfter: "",
      updatedBefore: "",
    },
  ])("omits the query for empty filters %o", (filters) => {
    expect(remotePipelineFiltersToQuery(filters)).toBeUndefined();
  });
});
