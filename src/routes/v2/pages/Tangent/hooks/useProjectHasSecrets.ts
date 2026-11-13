import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

/**
 * Secrets belong to the project's workspace team. A team someone can't act as
 * (not a member, unavailable, or failed to load) still has secrets, so only a
 * workspace with no team, or one still resolving, has none to show.
 */
export function useProjectHasSecrets(projectId: string): boolean {
  const team = useTeamForProjects([projectId]);
  return team.status !== "none" && team.status !== "resolving";
}
