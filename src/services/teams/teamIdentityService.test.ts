import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/sdk.gen", () => ({
  getCurrentUserApiUsersMeGet: vi.fn(),
}));

import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";

import { TeamIdentityError, TeamImpersonationError } from "./errors";
import { fetchTeamIdentity, fetchTeamMemberships } from "./teamIdentityService";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";
const HEADER_NAME = "x-tangle-impersonate-team-id";

const respond = (status: number, body: { data?: unknown; error?: unknown }) =>
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue({
    data: body.data,
    error: body.error,
    request: new Request("http://localhost/api/users/me"),
    response: new Response(null, { status }),
  } as never);

describe("fetchTeamIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__TANGLE_TEAM_IMPERSONATION__ = { headerName: HEADER_NAME };
  });

  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
  });

  it("asks who the caller is while acting as the team", async () => {
    respond(200, { data: { id: TEAM_ID, permissions: ["read", "write"] } });

    await expect(fetchTeamIdentity(TEAM_ID)).resolves.toEqual({
      id: TEAM_ID,
      permissions: ["read", "write"],
    });
    expect(getCurrentUserApiUsersMeGet).toHaveBeenCalledWith({
      headers: { [HEADER_NAME]: TEAM_ID },
    });
  });

  it("throws a TeamImpersonationError when the backend refuses the team", async () => {
    const refusal = `Impersonation error: User alice@example.com is not a member of the team ${TEAM_ID}`;
    respond(401, { error: { detail: refusal } });

    const failure = fetchTeamIdentity(TEAM_ID);

    await expect(failure).rejects.toBeInstanceOf(TeamImpersonationError);
    await expect(failure).rejects.toMatchObject({
      message: refusal,
      status: 401,
    });
  });

  it("throws a TeamIdentityError carrying the reason for any other failure", async () => {
    respond(401, { error: { detail: "Authentication required" } });

    const failure = fetchTeamIdentity(TEAM_ID);

    await expect(failure).rejects.toBeInstanceOf(TeamIdentityError);
    await expect(failure).rejects.toMatchObject({
      message: `Failed to check access to team ${TEAM_ID}: Authentication required`,
      status: 401,
    });
  });
});

describe("fetchTeamMemberships", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the user's teams without acting as one", async () => {
    respond(200, {
      data: {
        id: "alice@example.com",
        permissions: ["read", "write"],
        teams: { [TEAM_ID]: { roles: ["editor"] } },
      },
    });

    await expect(fetchTeamMemberships()).resolves.toEqual([
      { teamId: TEAM_ID, roles: ["editor"] },
    ]);
    expect(getCurrentUserApiUsersMeGet).toHaveBeenCalledWith();
  });

  it("throws a TeamIdentityError carrying the reason when the user can't be read", async () => {
    respond(500, { error: { detail: "Database unavailable" } });

    const failure = fetchTeamMemberships();

    await expect(failure).rejects.toBeInstanceOf(TeamIdentityError);
    await expect(failure).rejects.toMatchObject({
      message: "Failed to list your teams: Database unavailable",
      status: 500,
    });
  });
});
