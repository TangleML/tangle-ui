import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TeamResolution } from "@/services/teams/types";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

import { useProjectHasSecrets } from "./useProjectHasSecrets";

vi.mock("@/services/teams/useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(),
}));

const TEAM = { id: "ml-team@example.com", label: "ML Research" };

function hasSecrets(resolution: TeamResolution) {
  vi.mocked(useTeamForProjects).mockReturnValue(resolution);
  return renderHook(() => useProjectHasSecrets("project-1")).result.current;
}

describe("useProjectHasSecrets", () => {
  afterEach(() => vi.clearAllMocks());

  it("asks for the team of the project", () => {
    hasSecrets({ status: "none" });

    expect(useTeamForProjects).toHaveBeenCalledWith(["project-1"]);
  });

  it("has secrets in a project whose workspace has a team", () => {
    expect(
      hasSecrets({ status: "active", team: { ...TEAM, canWrite: true } }),
    ).toBe(true);
  });

  it.each<TeamResolution>([
    { status: "not-member", team: TEAM },
    { status: "unavailable", team: TEAM },
    { status: "error", error: new Error("backend down") },
  ])(
    "still has secrets when you can't act as the workspace's team ($status)",
    (resolution) => {
      expect(hasSecrets(resolution)).toBe(true);
    },
  );

  it.each<TeamResolution>([{ status: "none" }, { status: "resolving" }])(
    "has none while the workspace has no team or it is still resolving ($status)",
    (resolution) => {
      expect(hasSecrets(resolution)).toBe(false);
    },
  );
});
