import { describe, expect, it } from "vitest";

import { runManagement } from "./runManagement";
import type { TeamResolution } from "./types";

const TEAM = { id: "ml-team@example.com", label: "ML Research" };
const activeTeam = (canWrite: boolean): TeamResolution => ({
  status: "active",
  team: { ...TEAM, canWrite },
});

describe("runManagement", () => {
  it("lets you manage a run you created, as you", () => {
    expect(runManagement("morgan", "morgan", { status: "none" })).toEqual({
      canManage: true,
      teamId: undefined,
    });
  });

  it("lets a member manage a run the team created, as the team", () => {
    expect(runManagement(TEAM.id, "morgan", activeTeam(true))).toEqual({
      canManage: true,
      teamId: TEAM.id,
    });
  });

  it("keeps a run the team created from a member who can't write", () => {
    expect(runManagement(TEAM.id, "morgan", activeTeam(false))).toEqual({
      canManage: false,
      teamId: TEAM.id,
    });
  });

  it("keeps a run the team created from someone outside the team", () => {
    expect(
      runManagement(TEAM.id, "morgan", { status: "not-member", team: TEAM }),
    ).toEqual({ canManage: false, teamId: undefined });
  });

  it("manages a run you created in a team's project as you", () => {
    expect(runManagement("morgan", "morgan", activeTeam(true))).toEqual({
      canManage: true,
      teamId: undefined,
    });
  });

  it("keeps someone else's run from you", () => {
    expect(runManagement("riley", "morgan", activeTeam(true))).toEqual({
      canManage: false,
      teamId: undefined,
    });
  });

  it("keeps a run from you until you're known", () => {
    expect(runManagement(undefined, undefined, { status: "none" })).toEqual({
      canManage: false,
      teamId: undefined,
    });
  });
});
