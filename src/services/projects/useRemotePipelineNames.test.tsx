import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invalidatePipelineQueries } from "@/services/pipelineStorage/invalidatePipelineQueries";
import { getRemotePipelineName } from "@/services/remotePipelinesService";

import type { ProjectResourceSummary } from "./types";
import { useRemotePipelineNames } from "./useRemotePipelineNames";

const BACKEND_URL = "https://backend.example.com";

const backend = vi.hoisted(() => ({ configured: true, available: true }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: BACKEND_URL, ...backend }),
}));

vi.mock("@/services/remotePipelinesService", () => ({
  getRemotePipelineName: vi.fn(),
}));

let queryClient: QueryClient;

function row(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "row-1",
    projectId: "project-1",
    entity: "pipeline",
    name: "Make a basic hello world pipeline",
    entityId: "pipeline-1",
    metadata: null,
    createdBy: null,
    createdAt: new Date("2026-10-28T10:00:00Z"),
    updatedAt: new Date("2026-10-28T10:00:00Z"),
    ...overrides,
  };
}

const names = (resources: ProjectResourceSummary[]) =>
  renderHook(() => useRemotePipelineNames(resources), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

describe("useRemotePipelineNames", () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    backend.configured = true;
    backend.available = true;
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.resetAllMocks();
  });

  it("reports what a backend pipeline is called now, keyed by row", async () => {
    vi.mocked(getRemotePipelineName).mockResolvedValue(
      "Workspace secret hello world",
    );

    const { result } = names([row()]);

    await waitFor(() =>
      expect(result.current.get("row-1")).toBe("Workspace secret hello world"),
    );
    expect(getRemotePipelineName).toHaveBeenCalledWith(
      BACKEND_URL,
      "pipeline-1",
    );
  });

  it("picks up a rename once pipeline queries are invalidated", async () => {
    vi.mocked(getRemotePipelineName).mockResolvedValue("Before");
    const { result } = names([row()]);
    await waitFor(() => expect(result.current.get("row-1")).toBe("Before"));

    vi.mocked(getRemotePipelineName).mockResolvedValue("After");
    act(() => invalidatePipelineQueries(queryClient, BACKEND_URL));

    await waitFor(() => expect(result.current.get("row-1")).toBe("After"));
  });

  it("only looks up rows that point at a backend pipeline", async () => {
    vi.mocked(getRemotePipelineName).mockResolvedValue("Churn model");

    const { result } = names([
      row(),
      row({ id: "row-2", entity: "document", entityId: null }),
      row({ id: "row-3", entityId: null }),
    ]);

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(getRemotePipelineName).toHaveBeenCalledTimes(1);
  });

  /** The caller falls back to the row's own copy for anything left out. */
  it("leaves out a pipeline the lookup could not name", async () => {
    vi.mocked(getRemotePipelineName)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Failed to load pipelines (503)"));

    const { result } = names([
      row(),
      row({ id: "row-2", entityId: "pipeline-2" }),
    ]);

    await waitFor(() => expect(getRemotePipelineName).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(queryClient.isFetching({ queryKey: ["remote-pipelines"] })).toBe(
        0,
      ),
    );
    expect(result.current.size).toBe(0);
  });

  it("asks nothing of a backend that is not reachable", () => {
    backend.available = false;

    const { result } = names([row()]);

    expect(result.current.size).toBe(0);
    expect(getRemotePipelineName).not.toHaveBeenCalled();
  });
});
