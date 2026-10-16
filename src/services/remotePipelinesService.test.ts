import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import {
  listRemotePipelines,
  type RemotePipeline,
  type RemotePipelineFilters,
  remotePipelineFiltersToQuery,
} from "./remotePipelinesService";

vi.mock("@/api/client.gen", () => ({
  client: { post: vi.fn() },
}));

const BACKEND_URL = "https://backend.example.com";

const pipeline: RemotePipeline = {
  id: "pipeline-1",
  user_id: "user@example.com",
  pipeline_name: "Example pipeline",
  file_path: "Example pipeline",
  created_at: "2026-09-22T17:26:29Z",
  updated_at: "2026-09-23T17:26:29Z",
  current_version: "version-1",
  versioning_mode: "full",
};

function mockResponse<T>(data: T, status = 200) {
  vi.mocked(client.post).mockResolvedValue({
    data,
    error: undefined,
    request: new Request(BACKEND_URL),
    response: new Response(null, { status }),
  });
}

describe("listRemotePipelines", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

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

  it("ignores a total count from older responses", async () => {
    mockResponse({
      pipelines: [pipeline],
      total_count: 50,
      next_page_token: "page-2",
    });

    await expect(listRemotePipelines(BACKEND_URL)).resolves.toEqual({
      pipelines: [pipeline],
      nextPageToken: "page-2",
    });
  });

  it("rejects with a clear error when the API returns no data", async () => {
    mockResponse(undefined, 503);

    await expect(listRemotePipelines(BACKEND_URL)).rejects.toThrow(
      "Failed to load pipelines (503)",
    );
  });
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
