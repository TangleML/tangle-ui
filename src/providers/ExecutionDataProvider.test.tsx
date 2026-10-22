import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ExecutionDataProvider,
  useExecutionData,
} from "./ExecutionDataProvider";

const mocks = vi.hoisted(() => ({
  useGraphExecutionData: vi.fn(),
  useSubgraphBreadcrumbs: vi.fn(),
  useFetchPipelineRunMetadata: vi.fn(),
}));
vi.mock("@/hooks/useGraphExecutionData", () => ({
  useGraphExecutionData: mocks.useGraphExecutionData,
}));
vi.mock("@/hooks/useSubgraphBreadcrumbs", () => ({
  useSubgraphBreadcrumbs: mocks.useSubgraphBreadcrumbs,
}));
vi.mock("@/services/executionService", () => ({
  useFetchPipelineRunMetadata: mocks.useFetchPipelineRunMetadata,
}));

const rootDetails = {
  pipeline_run_id: "run-1",
  child_task_execution_ids: { nested: "exec-nested" },
};
const nestedDetails = {
  pipeline_run_id: "run-1",
  child_task_execution_ids: { worker: "exec-worker" },
};
const rootState = {
  child_execution_status_stats: { "exec-nested": { Running: 1 } },
};
const nestedState = {
  child_execution_status_stats: { "exec-worker": { Succeeded: 1 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useGraphExecutionData.mockImplementation((id: string) => ({
    details: id
      ? id === "exec-root"
        ? rootDetails
        : nestedDetails
      : undefined,
    state: id ? (id === "exec-root" ? rootState : nestedState) : undefined,
    isLoading: false,
    error: null,
  }));
  mocks.useSubgraphBreadcrumbs.mockReturnValue({
    segments: [],
    isLoading: false,
    error: null,
  });
  mocks.useFetchPipelineRunMetadata.mockReturnValue({
    data: { id: "run-1", root_execution_id: "exec-root" },
    isLoading: false,
    error: null,
  });
});
afterEach(cleanup);

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ExecutionDataProvider pipelineRunId="run-1">
      {children}
    </ExecutionDataProvider>
  );
}

describe("ExecutionDataProvider", () => {
  it("exposes root execution data without a document provider", () => {
    const { result } = renderHook(() => useExecutionData(), { wrapper });
    expect(result.current.currentExecutionId).toBe("exec-root");
    expect(result.current.details).toBe(rootDetails);
    expect(result.current.state).toBe(rootState);
    expect(result.current.rootDetails).toBe(rootDetails);
  });

  it("takes its nested execution directly from the supplied ID", () => {
    const { result } = renderHook(() => useExecutionData(), {
      wrapper: ({ children }) => (
        <ExecutionDataProvider
          pipelineRunId="run-1"
          subgraphExecutionId="exec-nested"
        >
          {children}
        </ExecutionDataProvider>
      ),
    });
    expect(result.current.currentExecutionId).toBe("exec-nested");
    expect(result.current.details).toBe(nestedDetails);
    expect(result.current.state).toBe(nestedState);
    expect(result.current.rootDetails).toBe(rootDetails);
    expect(result.current.rootState).toBe(rootState);
    expect(mocks.useSubgraphBreadcrumbs).toHaveBeenCalledWith(
      "exec-root",
      "exec-nested",
    );
  });

  it("exposes a failed metadata request without trying the run ID as an execution ID", () => {
    const error = new Error("Run unavailable");
    mocks.useFetchPipelineRunMetadata.mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    });
    const { result } = renderHook(() => useExecutionData(), { wrapper });
    expect(result.current.error).toBe(error);
    expect(result.current.currentExecutionId).toBeUndefined();
    expect(mocks.useGraphExecutionData).not.toHaveBeenCalledWith("run-1");
  });

  it("surfaces breadcrumb errors instead of silently keeping the old navigation", () => {
    const error = new Error("Execution not found");
    mocks.useSubgraphBreadcrumbs.mockReturnValue({
      segments: [],
      isLoading: false,
      error,
    });
    const { result } = renderHook(() => useExecutionData(), { wrapper });
    expect(result.current.error).toBe(error);
  });
});
