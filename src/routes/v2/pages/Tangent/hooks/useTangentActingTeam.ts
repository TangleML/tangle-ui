import { actingTeamId } from "@/services/teams/teamResolution";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

export function useTangentActingTeam(
  projectId: string,
): (sessionId: string) => string | undefined {
  const teamId = actingTeamId(useTeamForProjects([projectId]));
  return () => teamId;
}
