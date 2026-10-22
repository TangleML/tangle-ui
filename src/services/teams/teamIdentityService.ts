import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { describeErrorBody } from "@/services/requestFailureMessage";

import {
  readImpersonationRefusal,
  TeamIdentityError,
  TeamImpersonationError,
} from "./errors";
import { readTeamMemberships } from "./teamMemberships";
import { teamRequestHeaders } from "./teamRequestHeaders";
import type { TeamIdentity, TeamMembership } from "./types";

function lookupFailure(failure: string, error: unknown, status: number) {
  const reason = describeErrorBody(error);
  return new TeamIdentityError(
    reason ? `${failure}: ${reason}` : failure,
    status,
  );
}

export async function fetchTeamMemberships(): Promise<TeamMembership[]> {
  const result = await getCurrentUserApiUsersMeGet();

  if (result.data) return readTeamMemberships(result.data);

  throw lookupFailure(
    "Failed to list your teams",
    result.error,
    result.response.status,
  );
}

export async function fetchTeamIdentity(teamId: string): Promise<TeamIdentity> {
  const result = await getCurrentUserApiUsersMeGet({
    headers: teamRequestHeaders(teamId),
  });

  if (result.data) {
    return { id: result.data.id, permissions: result.data.permissions };
  }

  const status = result.response.status;
  const refusal = readImpersonationRefusal(result.error);
  if (refusal) {
    throw new TeamImpersonationError(refusal, status);
  }

  throw lookupFailure(
    `Failed to check access to team ${teamId}`,
    result.error,
    status,
  );
}
