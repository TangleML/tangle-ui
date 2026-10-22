import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRunProjectContext } from "@/components/Project/useRunProjectContext";

import type { TeamResolution } from "./types";
import { useActingTeam } from "./useActingTeam";
import { useTeamForSubmission } from "./useTeamForSubmission";

vi.mock("./useTeamForSubmission", () => ({
  useTeamForSubmission: vi.fn(),
}));

vi.mock("@/components/Project/useRunProjectContext", () => ({
  useRunProjectContext: vi.fn(),
}));

function linkProjects(projectIds: string[]) {
  vi.mocked(useRunProjectContext).mockReturnValue({
    projectIds,
  } as unknown as ReturnType<typeof useRunProjectContext>);
}

describe("useActingTeam", () => {
  beforeEach(() => {
    vi.mocked(useTeamForSubmission).mockReturnValue({ status: "none" });
  });

  it("resolves the team for the projects the page links to", () => {
    linkProjects(["linked-project", "other-project"]);

    renderHook(() => useActingTeam());

    expect(useTeamForSubmission).toHaveBeenLastCalledWith([
      "linked-project",
      "other-project",
    ]);
  });

  it("resolves no projects on a page outside any project", () => {
    linkProjects([]);

    renderHook(() => useActingTeam());

    expect(useTeamForSubmission).toHaveBeenLastCalledWith([]);
  });

  it("returns the team lookup's answer unchanged", () => {
    const resolution: TeamResolution = {
      status: "active",
      team: { id: "ml-team@example.com", label: "ML Research", canWrite: true },
    };
    vi.mocked(useTeamForSubmission).mockReturnValue(resolution);
    linkProjects(["linked-project"]);

    const { result } = renderHook(() => useActingTeam());

    expect(result.current).toBe(resolution);
  });
});
