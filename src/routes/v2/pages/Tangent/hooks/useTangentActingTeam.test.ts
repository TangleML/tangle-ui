import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TeamResolution } from "@/services/teams/types";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

import { useTangentActingTeam } from "./useTangentActingTeam";

vi.mock("@/services/teams/useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(),
}));

const research = { id: "research@example.com", label: "Research" };

function grantFor(team: TeamResolution) {
  vi.mocked(useTeamForProjects).mockReturnValue(team);
  const { result } = renderHook(() => useTangentActingTeam("project-1"));
  return result.current("session-1");
}

describe("useTangentActingTeam", () => {
  it("grants a message the team the user acts as", () => {
    expect(
      grantFor({ status: "active", team: { ...research, canWrite: true } }),
    ).toBe("research@example.com");
    expect(useTeamForProjects).toHaveBeenCalledWith(["project-1"]);
  });

  it.each<TeamResolution>([
    { status: "none" },
    { status: "resolving" },
    { status: "not-member", team: research },
    { status: "unavailable", team: research },
    { status: "conflict", teams: [research] },
    { status: "error", error: new Error("backend down") },
  ])("grants no team otherwise: %o", (team) => {
    expect(grantFor(team)).toBeUndefined();
  });

  it("grants the team the user acts as when the message is sent", () => {
    vi.mocked(useTeamForProjects).mockReturnValue({ status: "resolving" });
    const { result, rerender } = renderHook(() =>
      useTangentActingTeam("project-1"),
    );

    vi.mocked(useTeamForProjects).mockReturnValue({
      status: "active",
      team: { ...research, canWrite: true },
    });
    rerender();

    expect(result.current("session-1")).toBe("research@example.com");
  });
});
