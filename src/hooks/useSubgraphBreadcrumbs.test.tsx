import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GetExecutionInfoResponse } from "@/api/types.gen";
import * as executionService from "@/services/executionService";

import {
  buildExecutionUrl,
  useSubgraphBreadcrumbs,
} from "./useSubgraphBreadcrumbs";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "http://test-backend",
    configured: true,
    available: true,
    ready: true,
  }),
}));

describe("useSubgraphBreadcrumbs", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should return empty segments when subgraphExecutionId equals rootExecutionId", async () => {
    const rootExecutionId = "root-exec-123";
    const { result } = renderHook(
      () => useSubgraphBreadcrumbs(rootExecutionId, rootExecutionId),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.segments).toEqual([]);
    expect(result.current.path).toEqual(["root"]);
  });

  it("should return empty segments when subgraphExecutionId is undefined", async () => {
    const rootExecutionId = "root-exec-123";
    const { result } = renderHook(
      () => useSubgraphBreadcrumbs(rootExecutionId, undefined),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.segments).toEqual([]);
    expect(result.current.path).toEqual(["root"]);
  });

  it("should traverse backwards to build breadcrumb path", async () => {
    const rootExecutionId = "root-exec-123";
    const level1ExecutionId = "level1-exec-456";
    const level2ExecutionId = "level2-exec-789";

    const rootDetails: GetExecutionInfoResponse = {
      id: rootExecutionId,
      task_spec: {
        componentRef: {
          name: "Root Pipeline",
          digest: "root-digest",
          spec: {
            name: "Root Pipeline",
            implementation: {
              graph: {
                tasks: {
                  "Task Level 1": {
                    componentRef: {
                      name: "Subgraph Level 1",
                      digest: "level1-digest",
                    },
                  },
                },
              },
            },
          },
        },
      },
      child_task_execution_ids: {
        "Task Level 1": level1ExecutionId,
      },
      pipeline_run_id: "run-123",
    };

    const level1Details: GetExecutionInfoResponse = {
      id: level1ExecutionId,
      parent_execution_id: rootExecutionId,
      task_spec: {
        componentRef: {
          name: "Subgraph Level 1",
          digest: "level1-digest",
          spec: {
            name: "Subgraph Level 1",
            implementation: {
              graph: {
                tasks: {
                  "Task Level 2": {
                    componentRef: {
                      name: "Subgraph Level 2",
                      digest: "level2-digest",
                    },
                  },
                },
              },
            },
          },
        },
      },
      child_task_execution_ids: {
        "Task Level 2": level2ExecutionId,
      },
      pipeline_run_id: "run-123",
    };

    const level2Details: GetExecutionInfoResponse = {
      id: level2ExecutionId,
      parent_execution_id: level1ExecutionId,
      task_spec: {
        componentRef: {
          name: "Subgraph Level 2",
          digest: "level2-digest",
          spec: {
            name: "Subgraph Level 2",
            implementation: {
              graph: {
                tasks: {},
              },
            },
          },
        },
      },
      child_task_execution_ids: {},
      pipeline_run_id: "run-123",
    };

    // The hook traverses backwards and caches execution details:
    // 1. Fetch level2 details (gets parent_execution_id = level1)
    // 2. Fetch level1 details (cached for subsequent calls)
    // 3. Fetch root details
    vi.spyOn(executionService, "fetchExecutionDetails").mockImplementation(
      async (executionId: string) => {
        if (executionId === level2ExecutionId) return level2Details;
        if (executionId === level1ExecutionId) return level1Details;
        if (executionId === rootExecutionId) return rootDetails;
        throw new Error(`Unexpected execution ID: ${executionId}`);
      },
    );

    const { result } = renderHook(
      () => useSubgraphBreadcrumbs(rootExecutionId, level2ExecutionId),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0]).toMatchObject({
      taskId: "Task Level 1",
      executionId: level1ExecutionId,
      taskName: "Subgraph Level 1",
    });
    expect(result.current.segments[1]).toMatchObject({
      taskId: "Task Level 2",
      executionId: level2ExecutionId,
      taskName: "Subgraph Level 2",
    });
    expect(result.current.path).toEqual([
      "root",
      "Task Level 1",
      "Task Level 2",
    ]);
  });
});

describe("buildExecutionUrl", () => {
  it("should return root URL when subgraphExecutionId is undefined", () => {
    const url = buildExecutionUrl("root-exec-123");
    expect(url).toBe("/runs/root-exec-123");
  });

  it("should return root URL when subgraphExecutionId equals rootExecutionId", () => {
    const rootExecutionId = "root-exec-123";
    const url = buildExecutionUrl(rootExecutionId, rootExecutionId);
    expect(url).toBe("/runs/root-exec-123");
  });

  it("should return nested URL when subgraphExecutionId is different", () => {
    const rootExecutionId = "root-exec-123";
    const subgraphExecutionId = "subgraph-exec-456";
    const url = buildExecutionUrl(rootExecutionId, subgraphExecutionId);
    expect(url).toBe("/runs/root-exec-123/subgraph-exec-456");
  });
});
