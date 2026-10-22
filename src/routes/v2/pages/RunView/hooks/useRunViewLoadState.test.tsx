import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { RunViewLoadStateFallback } from "@/routes/v2/pages/RunView/components/RunViewLoadStateFallback";

import { useRunViewLoadState } from "./useRunViewLoadState";

const mocks = vi.hoisted(() => ({
  fetchExecutionDetails: vi.fn(),
  fetchExecutionState: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://example.com",
    configured: true,
    available: true,
    ready: true,
  }),
}));
vi.mock("@/services/executionService", () => ({
  fetchExecutionDetails: mocks.fetchExecutionDetails,
  fetchExecutionState: mocks.fetchExecutionState,
  useFetchPipelineRunMetadata: () => ({
    data: { id: "run-1", root_execution_id: "execution-1" },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("@/hooks/useTrackRecentlyViewedRun", () => ({
  useTrackRecentlyViewedRun: vi.fn(),
}));

let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  mocks.fetchExecutionDetails.mockResolvedValue({
    id: "execution-1",
    task_spec: {
      componentRef: {
        spec: { name: "Example pipeline", implementation: { graph: {} } },
      },
    },
  });
  mocks.fetchExecutionState.mockResolvedValue({
    child_execution_status_stats: { task: { Succeeded: 1 } },
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

function RunContent() {
  const loadState = useRunViewLoadState("run-1");
  return loadState.status === "spec" ? (
    <div>{loadState.spec.name}</div>
  ) : (
    <RunViewLoadStateFallback state={loadState} />
  );
}

function renderRun() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ExecutionDataProvider pipelineRunId="run-1">
        <RunContent />
      </ExecutionDataProvider>
    </QueryClientProvider>,
  );
}

it("shows an initial state-request failure instead of rendering an empty run", async () => {
  let rejectState!: (error: Error) => void;
  mocks.fetchExecutionState.mockReturnValue(
    new Promise((_, reject) => {
      rejectState = reject;
    }),
  );
  renderRun();
  await waitFor(() => expect(mocks.fetchExecutionState).toHaveBeenCalled());
  expect(screen.getByText("Loading Pipeline Run")).toBeInTheDocument();
  expect(screen.queryByText("Example pipeline")).not.toBeInTheDocument();

  act(() => rejectState(new Error("Execution state unavailable")));
  expect(
    await screen.findByText("Error loading pipeline run"),
  ).toBeInTheDocument();
  expect(screen.getByText("Execution state unavailable")).toBeInTheDocument();
  expect(screen.queryByText("Example pipeline")).not.toBeInTheDocument();
});

it("keeps a previously loaded run visible when a state refresh fails", async () => {
  renderRun();
  expect(await screen.findByText("Example pipeline")).toBeInTheDocument();
  mocks.fetchExecutionState.mockRejectedValue(new Error("Refresh failed"));

  await act(() =>
    queryClient.invalidateQueries({ queryKey: ["execution-state"] }),
  );
  expect(
    queryClient.getQueryState([
      "execution-state",
      "https://example.com",
      "execution-1",
    ])?.error?.message,
  ).toBe("Refresh failed");
  expect(screen.getByText("Example pipeline")).toBeInTheDocument();
  expect(
    screen.queryByText("Error loading pipeline run"),
  ).not.toBeInTheDocument();
});
