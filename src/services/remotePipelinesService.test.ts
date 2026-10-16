import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import {
  listRemotePipelines,
  type RemotePipeline,
} from "./remotePipelinesService";

vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn() },
}));

const BACKEND_URL = "https://backend.example.com";

const pipeline: RemotePipeline = {
  id: "pipeline-1",
  user_id: "user@example.com",
  pipeline_name: "Example pipeline",
  created_at: "2026-09-22T17:26:29Z",
  updated_at: "2026-09-23T17:26:29Z",
  current_version: "version-1",
};

function mockResponse(data: unknown, status = 200) {
  vi.mocked(client.get).mockResolvedValue({
    data,
    response: { status },
  } as unknown as ReturnType<typeof client.get>);
}

describe("listRemotePipelines", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("uses the endpoint defaults without filters or pagination options", async () => {
    mockResponse({ pipelines: [] });

    await expect(listRemotePipelines(BACKEND_URL)).resolves.toEqual([]);

    expect(client.get).toHaveBeenCalledExactlyOnceWith({
      baseUrl: BACKEND_URL,
      url: "/api/pipelines/search",
    });
  });

  it("returns the first page without requesting the next page", async () => {
    mockResponse({
      pipelines: [pipeline],
      total_count: 50,
      next_page_token: "page-2",
    });

    await expect(listRemotePipelines(BACKEND_URL)).resolves.toEqual([pipeline]);

    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("rejects with a clear error when the API returns no data", async () => {
    mockResponse(undefined, 503);

    await expect(listRemotePipelines(BACKEND_URL)).rejects.toThrow(
      "Failed to fetch remote pipelines (503)",
    );
  });
});
