import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelPipelineRun } from "@/services/pipelineRunService";

import { useCancelPipelineRun } from "./useCancelPipelineRun";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.test", available: true }),
}));

vi.mock("@/services/pipelineRunService", () => ({
  cancelPipelineRun: vi.fn(),
}));

const TEAM_ID = "ml-team@example.com";

function renderCancel(teamId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return renderHook(() => useCancelPipelineRun("run-1", teamId), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useCancelPipelineRun", () => {
  afterEach(() => vi.clearAllMocks());

  it("cancels a team's run as the team", async () => {
    vi.mocked(cancelPipelineRun).mockResolvedValue(undefined);
    const { result } = renderCancel(TEAM_ID);

    act(() => result.current.confirmCancel());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("Pipeline run cancelled", "success"),
    );
    expect(cancelPipelineRun).toHaveBeenCalledWith(
      "run-1",
      "https://backend.test",
      TEAM_ID,
    );
  });

  it("cancels as you without a team", async () => {
    vi.mocked(cancelPipelineRun).mockResolvedValue(undefined);
    const { result } = renderCancel();

    act(() => result.current.confirmCancel());

    await waitFor(() =>
      expect(cancelPipelineRun).toHaveBeenCalledWith(
        "run-1",
        "https://backend.test",
        undefined,
      ),
    );
  });
});
