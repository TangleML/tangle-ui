import type { TeamResolution } from "./types";

export interface RunManagement {
  canManage: boolean;
  teamId: string | undefined;
}

export function runManagement(
  createdBy: string | null | undefined,
  currentUserId: string | undefined,
  team: TeamResolution,
): RunManagement {
  if (team.status === "active" && createdBy === team.team.id) {
    return { canManage: team.team.canWrite, teamId: team.team.id };
  }
  return {
    canManage: !!currentUserId && createdBy === currentUserId,
    teamId: undefined,
  };
}
