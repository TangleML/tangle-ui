import type { GetUserResponse } from "@/api/types.gen";
import { isRecord } from "@/utils/typeGuards";

import type { TeamMembership } from "./types";

function readRoles(membership: unknown): string[] {
  if (!isRecord(membership) || !Array.isArray(membership.roles)) return [];
  return membership.roles.filter(
    (role): role is string => typeof role === "string",
  );
}

export function readTeamMemberships(user: GetUserResponse): TeamMembership[] {
  const teams = "teams" in user ? user.teams : undefined;
  if (!isRecord(teams)) return [];

  return Object.entries(teams).map(([teamId, membership]) => ({
    teamId,
    roles: readRoles(membership),
  }));
}
