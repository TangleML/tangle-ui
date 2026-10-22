import { afterEach, describe, expect, it } from "vitest";

import { getTeamImpersonationHeaderName } from "./teamImpersonation";

describe("getTeamImpersonationHeaderName", () => {
  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
  });

  it("is null when the host page configures nothing", () => {
    expect(getTeamImpersonationHeaderName()).toBeNull();
  });

  it("returns the configured header name, trimmed", () => {
    window.__TANGLE_TEAM_IMPERSONATION__ = {
      headerName: "  x-tangle-impersonate-team-id ",
    };

    expect(getTeamImpersonationHeaderName()).toBe(
      "x-tangle-impersonate-team-id",
    );
  });

  it("is null for a header name fetch would reject", () => {
    window.__TANGLE_TEAM_IMPERSONATION__ = { headerName: "x team id" };

    expect(getTeamImpersonationHeaderName()).toBeNull();
  });

  it("is null for an empty or missing header name", () => {
    window.__TANGLE_TEAM_IMPERSONATION__ = { headerName: "   " };
    expect(getTeamImpersonationHeaderName()).toBeNull();

    window.__TANGLE_TEAM_IMPERSONATION__ = {} as never;
    expect(getTeamImpersonationHeaderName()).toBeNull();
  });
});
