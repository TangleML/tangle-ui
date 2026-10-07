import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineRunResponse } from "@/api/types.gen";

import { useRunPermissions } from "./useRunPermissions";

const mockGetMyScopes = vi.hoisted(() => vi.fn());
const mockFetchRunAnnotations = vi.hoisted(() => vi.fn());

vi.mock("./accessControlApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./accessControlApi")>()),
  getMyScopes: mockGetMyScopes,
}));

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: mockFetchRunAnnotations,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://backend" }),
}));

const run = {
  id: "run-1",
  created_by: "ada@example.com",
} as PipelineRunResponse;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useRunPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRunAnnotations.mockResolvedValue({
      "tangleml.com/user-pipeline/pipeline-id": "pipeline-1",
    });
  });

  it("lets the run creator cancel and annotate without asking the backend", () => {
    const { result } = renderHook(
      () => useRunPermissions(run, "ada@example.com"),
      { wrapper },
    );

    expect(result.current).toEqual({ canCancel: true, canAnnotate: true });
    expect(mockGetMyScopes).not.toHaveBeenCalled();
  });

  it("uses scopes inherited from the run's pipeline", async () => {
    mockGetMyScopes.mockResolvedValue(["run:cancel"]);

    const { result } = renderHook(
      () => useRunPermissions(run, "sam@example.com"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.canCancel).toBe(true));
    expect(result.current.canAnnotate).toBe(false);
    expect(mockGetMyScopes).toHaveBeenCalledWith("pipeline_run", "run-1");
  });

  it("denies when the backend has no access control", async () => {
    mockGetMyScopes.mockRejectedValue(new Error("Not Found"));

    const { result } = renderHook(
      () => useRunPermissions(run, "sam@example.com"),
      { wrapper },
    );

    await waitFor(() => expect(mockGetMyScopes).toHaveBeenCalled());
    expect(result.current).toEqual({ canCancel: false, canAnnotate: false });
  });
});
