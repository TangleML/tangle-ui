import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";

import { useTeamForProjects } from "./useTeamForProjects";
import { useTeamForSubmission } from "./useTeamForSubmission";

vi.mock("./useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(() => ({ status: "none" })),
}));

vi.mock("@/providers/RunSubmissionScopeProvider", () => ({
  useRunSubmissionAnnotations: vi.fn(() => ({})),
}));

describe("useTeamForSubmission", () => {
  beforeEach(() => {
    vi.mocked(useRunSubmissionAnnotations).mockReturnValue({});
  });

  it("resolves the team of the projects a run is filed under", () => {
    renderHook(() => useTeamForSubmission(["chosen-project"]));

    expect(useTeamForProjects).toHaveBeenLastCalledWith(["chosen-project"]);
  });

  it("adds the project the page files every run under", () => {
    vi.mocked(useRunSubmissionAnnotations).mockReturnValue(
      projectRunAnnotations(["tangent-project"]),
    );

    renderHook(() => useTeamForSubmission(["chosen-project"]));

    expect(useTeamForProjects).toHaveBeenLastCalledWith([
      "tangent-project",
      "chosen-project",
    ]);
  });

  it("counts a project named twice once", () => {
    vi.mocked(useRunSubmissionAnnotations).mockReturnValue(
      projectRunAnnotations(["same-project"]),
    );

    renderHook(() => useTeamForSubmission(["same-project"]));

    expect(useTeamForProjects).toHaveBeenLastCalledWith(["same-project"]);
  });
});
