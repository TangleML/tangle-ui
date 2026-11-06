import { describe, expect, it } from "vitest";

import { TeamIdentityError, TeamImpersonationError } from "./errors";
import {
  actingTeamId,
  fallsBackToYou,
  resolveTeam,
  teamAccess,
} from "./teamResolution";
import type { TeamIdentity, TeamMembership } from "./types";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";
const OTHER_TEAM_ID = "data-team@project.iam.gserviceaccount.com";
const team = { id: TEAM_ID, label: "ML Research" };
const otherTeam = { id: OTHER_TEAM_ID, label: "Data" };

const settled = { isPending: false, error: null };
const member: TeamMembership[] = [{ teamId: TEAM_ID, roles: ["editor"] }];
const editor: TeamIdentity = { id: TEAM_ID, permissions: ["read", "write"] };

const resolve = (overrides: Partial<Parameters<typeof resolveTeam>[0]> = {}) =>
  resolveTeam({
    lookups: [settled],
    teams: [team],
    memberships: { data: member, error: null },
    identity: { data: editor, error: null },
    ...overrides,
  });

describe("teamAccess", () => {
  it("grants write to an editor acting as the team", () => {
    expect(teamAccess(TEAM_ID, editor)).toBe("write");
  });

  it("grants read to a reader acting as the team", () => {
    expect(teamAccess(TEAM_ID, { id: TEAM_ID, permissions: ["read"] })).toBe(
      "read",
    );
  });

  it("grants nothing when the backend answered as someone else", () => {
    expect(
      teamAccess(TEAM_ID, {
        id: "developer@localhost",
        permissions: ["read", "write", "admin"],
      }),
    ).toBe("none");
  });

  it("grants nothing to a role without read", () => {
    expect(teamAccess(TEAM_ID, { id: TEAM_ID, permissions: [] })).toBe("none");
  });
});

describe("resolveTeam", () => {
  it("is active, with write, for an editor of the projects' team", () => {
    expect(resolve()).toEqual({
      status: "active",
      team: { ...team, canWrite: true },
    });
  });

  it("is active, without write, for a reader", () => {
    expect(
      resolve({
        identity: { data: { id: TEAM_ID, permissions: ["read"] }, error: null },
      }),
    ).toEqual({ status: "active", team: { ...team, canWrite: false } });
  });

  it("is resolving while a project or workspace is still loading", () => {
    expect(
      resolve({ lookups: [settled, { isPending: true, error: null }] }),
    ).toEqual({ status: "resolving" });
  });

  it("reports a failed project or workspace lookup", () => {
    const error = new Error("Failed to fetch workspace w1");

    expect(resolve({ lookups: [{ isPending: false, error }] })).toEqual({
      status: "error",
      error,
    });
  });

  it("is none when no project's workspace names a team", () => {
    expect(resolve({ teams: [] })).toEqual({ status: "none" });
  });

  it("is a conflict when the projects belong to different teams", () => {
    expect(resolve({ teams: [team, otherTeam] })).toEqual({
      status: "conflict",
      teams: [team, otherTeam],
    });
  });

  it("is resolving until the user's teams are known", () => {
    expect(resolve({ memberships: { data: undefined, error: null } })).toEqual({
      status: "resolving",
    });
  });

  it("reports a failed lookup of the user's teams", () => {
    const error = new Error("Failed to fetch user details");

    expect(resolve({ memberships: { data: undefined, error } })).toEqual({
      status: "error",
      error,
    });
  });

  it("is not-member when the user is not in the team", () => {
    expect(
      resolve({
        memberships: {
          data: [{ teamId: OTHER_TEAM_ID, roles: ["editor"] }],
          error: null,
        },
      }),
    ).toEqual({ status: "not-member", team });
  });

  it("is resolving until the backend confirms the team", () => {
    expect(resolve({ identity: { data: undefined, error: null } })).toEqual({
      status: "resolving",
    });
  });

  it("is unavailable when the backend refuses to act as the team", () => {
    expect(
      resolve({
        identity: {
          data: undefined,
          error: new TeamImpersonationError(
            `Impersonation error: Unknown team ${TEAM_ID}`,
            401,
          ),
        },
      }),
    ).toEqual({ status: "unavailable", team });
  });

  it("is unavailable when the backend ignores the team", () => {
    expect(
      resolve({
        identity: {
          data: { id: "developer@localhost", permissions: ["read", "write"] },
          error: null,
        },
      }),
    ).toEqual({ status: "unavailable", team });
  });

  it("reports any other failure to confirm the team", () => {
    const error = new TeamIdentityError("Failed to check access", 500);

    expect(resolve({ identity: { data: undefined, error } })).toEqual({
      status: "error",
      error,
    });
  });
});

describe("actingTeamId", () => {
  it("is the team's id only while it is active", () => {
    expect(actingTeamId(resolve())).toBe(TEAM_ID);
    expect(actingTeamId({ status: "not-member", team })).toBeUndefined();
    expect(actingTeamId({ status: "resolving" })).toBeUndefined();
  });
});

describe("fallsBackToYou", () => {
  it("is true when the projects have a team you can't act as", () => {
    expect(fallsBackToYou({ status: "not-member", team })).toBe(true);
    expect(fallsBackToYou({ status: "unavailable", team })).toBe(true);
    expect(
      fallsBackToYou({ status: "error", error: new Error("lookup failed") }),
    ).toBe(true);
  });

  it("is false when the run acts as expected or can't be submitted", () => {
    expect(fallsBackToYou(resolve())).toBe(false);
    expect(fallsBackToYou({ status: "none" })).toBe(false);
    expect(fallsBackToYou({ status: "resolving" })).toBe(false);
    expect(fallsBackToYou({ status: "conflict", teams: [team] })).toBe(false);
  });
});
