import { describe, expect, it } from "vitest";

import type { TeamResolution } from "@/services/teams/types";

import { sessionTeamBrief } from "./sessionTeam";

const research = { id: "research@example.com", label: "Research" };

const asProse = (brief: string | null) => brief?.replace(/\n\s*/g, " ");

describe("sessionTeamBrief", () => {
  it("briefs the team as a grant each call opts into", () => {
    const prose = asProse(
      sessionTeamBrief({
        status: "active",
        team: { ...research, canWrite: true },
      }),
    );

    expect(prose).toContain(
      "This project belongs to the Research workspace (team id research@example.com).",
    );
    expect(prose).toContain(
      "A run submitted as the workspace is created by it and can use only the workspace's secrets. A run submitted as the user can use only the user's.",
    );
    expect(prose).toContain(
      "A turn may act as the workspace only when the person whose message started it is in the workspace and grants it.",
    );
    expect(prose).toContain(
      "tools go as the user unless asked to act as the workspace (asTeam).",
    );
    expect(prose).toContain("Never send the team header yourself.");
    expect(prose).toContain(
      "tangle_root_config_show says whether the current turn may act as the workspace.",
    );
    expect(prose).toContain("Check secrets and submit as the same identity.");
    expect(prose).toContain(
      "Don't retry it as the user unless they ask for that.",
    );
    expect(prose).toContain("Secrets window");
    expect(prose).toContain(
      "Never ask for, store or pass on a secret's value.",
    );
    expect(prose).not.toContain("acts as");
  });

  it("doesn't speak for the session's creator", () => {
    const active = sessionTeamBrief({
      status: "active",
      team: { ...research, canWrite: true },
    });

    expect(sessionTeamBrief({ status: "not-member", team: research })).toBe(
      active,
    );
    expect(sessionTeamBrief({ status: "unavailable", team: research })).toBe(
      active,
    );
  });

  it.each<TeamResolution>([
    { status: "none" },
    { status: "resolving" },
    { status: "conflict", teams: [research] },
    { status: "error", error: new Error("backend down") },
  ])("briefs nothing without a known team: %o", (team) => {
    expect(sessionTeamBrief(team)).toBeNull();
  });
});
