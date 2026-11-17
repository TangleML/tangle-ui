import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFetchContainerExecutionState } from "./executionService";

const { mockFetchWithErrorHandling } = vi.hoisted(() => ({
  mockFetchWithErrorHandling: vi.fn(),
}));

vi.mock("@/utils/fetchWithErrorHandling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/fetchWithErrorHandling")>()),
  fetchWithErrorHandling: mockFetchWithErrorHandling,
}));

function renderContainerStateHook() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(
    () => useFetchContainerExecutionState("exec-1", "http://backend"),
    { wrapper },
  );
}

describe("useFetchContainerExecutionState", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchWithErrorHandling.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls while the container is running and stops once it ends", async () => {
    mockFetchWithErrorHandling
      .mockResolvedValueOnce({ status: "RUNNING" })
      .mockResolvedValueOnce({ status: "SUCCEEDED" });

    const { result } = renderContainerStateHook();
    await waitFor(() => expect(result.current.data?.status).toBe("RUNNING"));

    await act(() => vi.advanceTimersByTimeAsync(5000));
    await waitFor(() => expect(result.current.data?.status).toBe("SUCCEEDED"));

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(mockFetchWithErrorHandling).toHaveBeenCalledTimes(2);
  });
});
