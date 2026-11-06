import { describe, expect, it } from "vitest";

import { resolveTeamId, teamOfWorkspace } from "./workspaceTeam";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";

describe("resolveTeamId", () => {
  it("reads the team from the workspace's data", () => {
    expect(resolveTeamId({ metadata: { teamId: TEAM_ID } })).toBe(TEAM_ID);
  });

  it("trims the team id", () => {
    expect(resolveTeamId({ metadata: { teamId: `  ${TEAM_ID} ` } })).toBe(
      TEAM_ID,
    );
  });

  it("is null for a workspace without a team", () => {
    expect(resolveTeamId({ metadata: null })).toBeNull();
    expect(resolveTeamId({ metadata: { tangentBaseUrl: "x" } })).toBeNull();
  });

  it("is null for a team id that is not a non-empty string", () => {
    expect(resolveTeamId({ metadata: { teamId: "  " } })).toBeNull();
    expect(resolveTeamId({ metadata: { teamId: 42 } })).toBeNull();
  });
});

describe("teamOfWorkspace", () => {
  it("labels the team with the workspace's name", () => {
    expect(
      teamOfWorkspace({ name: "ML Research", metadata: { teamId: TEAM_ID } }),
    ).toEqual({ id: TEAM_ID, label: "ML Research" });
  });

  it("is null for a workspace without a team", () => {
    expect(teamOfWorkspace({ name: "Sandbox", metadata: null })).toBeNull();
  });
});
