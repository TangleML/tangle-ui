import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import {
  listRemotePipelines,
  type RemotePipeline,
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
