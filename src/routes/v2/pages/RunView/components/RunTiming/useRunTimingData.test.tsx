import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GetExecutionInfoResponse } from "@/api/types.gen";

import type { RunTimingData } from "./runTiming.types";
import { fetchRunTimingData } from "./runTimingService";
import { useRunTimingData } from "./useRunTimingData";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://example.test" }),
}));

vi.mock("./runTimingService", () => ({
  fetchRunTimingData: vi.fn(),
}));

const rootDetails: GetExecutionInfoResponse = {
  id: "root-exec",
  child_task_execution_ids: {},
  task_spec: { componentRef: { spec: { name: "Example pipeline" } } },
};

const timingData: RunTimingData = {
  tasks: [],
  truncated: false,
  criticalPathExecutionIds: new Set(),
  metrics: {
    totalTaskCount: 0,
    cachedTaskCount: 0,
    startupCoverage: 0,
    busyRuntimeMs: 0,
    busyPercent: 0,
  },
};

const queryClients: QueryClient[] = [];

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  for (const queryClient of queryClients) queryClient.clear();
  queryClients.length = 0;
});

describe("useRunTimingData", () => {
  it("refreshes immediately on mount when cached timing data is still fresh", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(queryClient);
    queryClient.setQueryData(
      ["run-timing", "https://example.test", "root-exec", undefined],
      timingData,
    );
    vi.mocked(fetchRunTimingData).mockResolvedValue(timingData);

    renderHook(
      () =>
        useRunTimingData({
          rootDetails,
          runCreatedAt: undefined,
          runComplete: true,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(fetchRunTimingData).toHaveBeenCalledTimes(1);
    });
  });
});
