import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import { ProjectRunsApiError } from "./errors";
import { listProjectRuns } from "./projectRunsService";

vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn() },
}));

const runDto = {
  id: "run-1",
  root_execution_id: "exec-1",
  created_by: "alice@example.com",
  created_at: "2026-09-16T18:24:57.077103Z",
  pipeline_name: "Hello World",
};

function mockResponse(data: unknown, status = 200) {
  vi.mocked(client.get).mockResolvedValue({
    data,
    response: { status },
  } as unknown as ReturnType<typeof client.get>);
}

describe("listProjectRuns", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("asks the project's own runs endpoint", async () => {
    mockResponse({ runs: [], next_page_token: null });

    await listProjectRuns("project-1");

    expect(client.get).toHaveBeenCalledWith({
      url: "/api/projects/{project_id}/runs",
      path: { project_id: "project-1" },
      query: {
        page_token: undefined,
        since: undefined,
        until: undefined,
      },
    });
  });

  it("passes on the window and page it was given", async () => {
    mockResponse({ runs: [], next_page_token: null });

    await listProjectRuns("project-1", {
      pageToken: "token-2",
      since: "2026-09-01T00:00:00Z",
      until: "2026-09-30T00:00:00Z",
    });

    expect(client.get).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          page_token: "token-2",
          since: "2026-09-01T00:00:00Z",
          until: "2026-09-30T00:00:00Z",
        },
      }),
    );
  });

  it("turns the wire shape into the domain shape", async () => {
    mockResponse({ runs: [runDto], next_page_token: null });

    const page = await listProjectRuns("project-1");

    expect(page.items).toEqual([
      {
        id: "run-1",
        rootExecutionId: "exec-1",
        pipelineName: "Hello World",
        createdBy: "alice@example.com",
        createdAt: new Date("2026-09-16T18:24:57.077103Z"),
      },
    ]);
    expect(page.nextPageToken).toBeNull();
  });

  it("carries a page token onwards when there is one", async () => {
    mockResponse({ runs: [runDto], next_page_token: "token-2" });

    const page = await listProjectRuns("project-1");

    expect(page.nextPageToken).toBe("token-2");
  });

  it("reads a missing page token as the end of the list", async () => {
    mockResponse({ runs: [] });

    const page = await listProjectRuns("project-1");

    expect(page.nextPageToken).toBeNull();
  });

  it("keeps a run nobody named", async () => {
    mockResponse({
      runs: [{ ...runDto, pipeline_name: null, created_by: null }],
    });

    const page = await listProjectRuns("project-1");

    expect(page.items[0].pipelineName).toBeNull();
    expect(page.items[0].createdBy).toBeNull();
  });

  it("throws with the status when the backend gives nothing back", async () => {
    mockResponse(undefined, 503);

    await expect(listProjectRuns("project-1")).rejects.toThrow(
      ProjectRunsApiError,
    );
    await expect(listProjectRuns("project-1")).rejects.toMatchObject({
      status: 503,
    });
  });
});
