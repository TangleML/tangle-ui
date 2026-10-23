import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectsEnabled } from "@/components/shared/Settings/useFlags";
import { fetchRunAnnotations } from "@/services/pipelineRunService";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";

import { useRunTeam } from "./useRunTeam";
import { useTeamForSubmission } from "./useTeamForSubmission";

vi.mock("./useTeamForSubmission", () => ({
  useTeamForSubmission: vi.fn(() => ({ status: "none" })),
}));

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: vi.fn(),
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useProjectsEnabled: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.test" }),
}));

function resolveRunTeam(runId: string | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useRunTeam(runId), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useRunTeam", () => {
  beforeEach(() => {
    vi.mocked(useProjectsEnabled).mockReturnValue(true);
  });

  afterEach(() => vi.clearAllMocks());

  it("resolves the team of the projects the run is filed under", async () => {
    vi.mocked(fetchRunAnnotations).mockResolvedValue(
      projectRunAnnotations(["research-project"]),
    );

    const { result } = resolveRunTeam("42");

    expect(result.current).toEqual({ status: "resolving" });
    await waitFor(() => expect(result.current).toEqual({ status: "none" }));
    expect(useTeamForSubmission).toHaveBeenLastCalledWith(["research-project"]);
    expect(fetchRunAnnotations).toHaveBeenCalledWith(
      "42",
      "https://backend.test",
    );
  });

  it("says the team couldn't be checked when the run's projects can't be read", async () => {
    vi.mocked(fetchRunAnnotations).mockRejectedValue(new Error("backend down"));

    const { result } = resolveRunTeam("42");

    await waitFor(() =>
      expect(result.current).toEqual({
        status: "error",
        error: new Error("backend down"),
      }),
    );
  });

  it("reads nothing without projects", () => {
    vi.mocked(useProjectsEnabled).mockReturnValue(false);

    const { result } = resolveRunTeam("42");

    expect(result.current).toEqual({ status: "none" });
    expect(fetchRunAnnotations).not.toHaveBeenCalled();
  });

  it("reads nothing before the run is known", () => {
    const { result } = resolveRunTeam(undefined);

    expect(result.current).toEqual({ status: "none" });
    expect(fetchRunAnnotations).not.toHaveBeenCalled();
  });
});
