import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRunProjectContext } from "@/components/Project/useRunProjectContext";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";

import { useActingTeam } from "./useActingTeam";
import { useTeamForProjects } from "./useTeamForProjects";

vi.mock("./useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(() => ({ status: "none" })),
}));

vi.mock("@/providers/RunSubmissionScopeProvider", () => ({
  useRunSubmissionAnnotations: vi.fn(() => ({})),
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
    vi.mocked(useRunSubmissionAnnotations).mockReturnValue({});
    linkProjects([]);
  });

  it("resolves the team of the project the page is scoped to", () => {
    vi.mocked(useRunSubmissionAnnotations).mockReturnValue(
      projectRunAnnotations(["tangent-project"]),
    );

    renderHook(() => useActingTeam());

    expect(useTeamForProjects).toHaveBeenLastCalledWith(["tangent-project"]);
  });

  it("resolves the team of the project the page links to", () => {
    linkProjects(["linked-project"]);

    renderHook(() => useActingTeam());

    expect(useTeamForProjects).toHaveBeenLastCalledWith(["linked-project"]);
  });

  it("counts a project named by both sources once", () => {
    vi.mocked(useRunSubmissionAnnotations).mockReturnValue(
      projectRunAnnotations(["same-project"]),
    );
    linkProjects(["same-project", "other-project"]);

    renderHook(() => useActingTeam());

    expect(useTeamForProjects).toHaveBeenLastCalledWith([
      "same-project",
      "other-project",
    ]);
  });

  it("resolves no projects on a page outside any project", () => {
    renderHook(() => useActingTeam());

    expect(useTeamForProjects).toHaveBeenLastCalledWith([]);
  });

  it("returns what the team lookup decides", () => {
    vi.mocked(useTeamForProjects).mockReturnValueOnce({ status: "resolving" });

    const { result } = renderHook(() => useActingTeam());

    expect(result.current).toEqual({ status: "resolving" });
  });
});
