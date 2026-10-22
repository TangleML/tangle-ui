import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGraphExecutionData } from "./useGraphExecutionData";

const mocks = vi.hoisted(() => ({
  backendUrl: "http://backend-one",
  fetchExecutionDetails: vi.fn(),
  fetchExecutionState: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: mocks.backendUrl }),
}));
vi.mock("@/services/executionService", () => ({
  fetchExecutionDetails: mocks.fetchExecutionDetails,
  fetchExecutionState: mocks.fetchExecutionState,
}));

let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.backendUrl = "http://backend-one";
  queryClient = new QueryClient();
  mocks.fetchExecutionDetails.mockImplementation(async (id, backendUrl) => ({
    id,
    task_spec: { componentRef: { spec: { name: backendUrl } } },
  }));
  mocks.fetchExecutionState.mockResolvedValue({
    child_execution_status_stats: { task: { Succeeded: 1 } },
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useGraphExecutionData", () => {
  it("keeps the request disabled until an execution ID is available", () => {
    const { result } = renderHook(() => useGraphExecutionData(undefined), {
      wrapper,
    });
    expect(result.current.isLoading).toBe(false);
    expect(mocks.fetchExecutionDetails).not.toHaveBeenCalled();
    expect(mocks.fetchExecutionState).not.toHaveBeenCalled();
  });

  it("fetches execution details and state directly", async () => {
    const { result } = renderHook(() => useGraphExecutionData("execution-1"), {
      wrapper,
    });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.state).toBeDefined());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.details?.id).toBe("execution-1");
    expect(mocks.fetchExecutionDetails).toHaveBeenCalledWith(
      "execution-1",
      "http://backend-one",
    );
    expect(mocks.fetchExecutionState).toHaveBeenCalledWith(
      "execution-1",
      "http://backend-one",
    );
  });

  it("does not reuse another backend's execution with the same ID", async () => {
    const { result, rerender } = renderHook(
      () => useGraphExecutionData("execution-1"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state).toBeDefined());

    mocks.backendUrl = "http://backend-two";
    rerender();
    expect(result.current.details).toBeUndefined();
    await waitFor(() =>
      expect(result.current.details?.task_spec.componentRef.spec?.name).toBe(
        "http://backend-two",
      ),
    );
    expect(mocks.fetchExecutionDetails).toHaveBeenCalledTimes(2);
  });
});
