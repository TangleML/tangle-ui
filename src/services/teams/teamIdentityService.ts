import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { describeErrorBody } from "@/services/requestFailureMessage";

import {
  readImpersonationRefusal,
  TeamIdentityError,
  TeamImpersonationError,
} from "./errors";
import { teamRequestHeaders } from "./teamRequestHeaders";
import type { TeamIdentity } from "./types";

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

  const failure = `Failed to check access to team ${teamId}`;
  const reason = describeErrorBody(result.error);
  throw new TeamIdentityError(
    reason ? `${failure}: ${reason}` : failure,
    status,
  );
}
