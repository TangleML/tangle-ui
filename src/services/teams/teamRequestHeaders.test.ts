import { afterEach, describe, expect, it } from "vitest";

import { teamRequestHeaders } from "./teamRequestHeaders";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";

describe("teamRequestHeaders", () => {
  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
  });

  it("names the team in the configured header", () => {
    window.__TANGLE_TEAM_IMPERSONATION__ = {
      headerName: "x-tangle-impersonate-team-id",
    };

    expect(teamRequestHeaders(TEAM_ID)).toEqual({
      "x-tangle-impersonate-team-id": TEAM_ID,
    });
  });

  it("adds nothing without a team", () => {
    window.__TANGLE_TEAM_IMPERSONATION__ = {
      headerName: "x-tangle-impersonate-team-id",
    };

    expect(teamRequestHeaders(undefined)).toEqual({});
  });

  it("adds nothing when the host page configures no header", () => {
    expect(teamRequestHeaders(TEAM_ID)).toEqual({});
  });
});
