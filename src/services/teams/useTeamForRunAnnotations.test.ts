import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(() => ({ status: "none" })),
}));

import { projectRunAnnotations } from "@/utils/projectRunAnnotation";

import { useTeamForProjects } from "./useTeamForProjects";
import { useTeamForRunAnnotations } from "./useTeamForRunAnnotations";

describe("useTeamForRunAnnotations", () => {
  it("resolves the team of the projects a run is filed under", () => {
    const annotations = {
      ...projectRunAnnotations(["research-project", "data-project"]),
      source: "web-app",
    };

    renderHook(() => useTeamForRunAnnotations(annotations));

    expect(useTeamForProjects).toHaveBeenCalledWith([
      "research-project",
      "data-project",
    ]);
  });

  it("resolves no projects for a run filed under none", () => {
    renderHook(() => useTeamForRunAnnotations(null));

    expect(useTeamForProjects).toHaveBeenLastCalledWith([]);
  });
});
