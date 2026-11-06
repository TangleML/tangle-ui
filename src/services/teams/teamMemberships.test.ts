import { describe, expect, it } from "vitest";

import { readTeamMemberships } from "./teamMemberships";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";
const OTHER_TEAM_ID = "data-team@project.iam.gserviceaccount.com";

const userWithTeams = (teams: unknown) => ({
  id: "alice@example.com",
  permissions: ["read", "write"],
  teams,
});

describe("readTeamMemberships", () => {
  it("lists every team the user belongs to, with its roles", () => {
    expect(
      readTeamMemberships(
        userWithTeams({
          [TEAM_ID]: { roles: ["editor"] },
          [OTHER_TEAM_ID]: { roles: ["reader"] },
        }),
      ),
    ).toEqual([
      { teamId: TEAM_ID, roles: ["editor"] },
      { teamId: OTHER_TEAM_ID, roles: ["reader"] },
    ]);
  });

  it("is empty when the deployment has no teams or the user is in none", () => {
    expect(
      readTeamMemberships({ id: "alice@example.com", permissions: [] }),
    ).toEqual([]);
    expect(readTeamMemberships(userWithTeams(null))).toEqual([]);
  });

  it("keeps a membership whose roles are malformed, with no roles", () => {
    expect(
      readTeamMemberships(
        userWithTeams({
          [TEAM_ID]: { roles: "editor" },
          [OTHER_TEAM_ID]: { roles: ["reader", 7] },
        }),
      ),
    ).toEqual([
      { teamId: TEAM_ID, roles: [] },
      { teamId: OTHER_TEAM_ID, roles: ["reader"] },
    ]);
  });
});
