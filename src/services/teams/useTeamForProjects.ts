import { useQueries } from "@tanstack/react-query";

import { getTeamImpersonationHeaderName } from "@/config/teamImpersonation";
import { useBackend } from "@/providers/BackendProvider";
import { isProjectGone } from "@/services/projects/errors";
import { getProject } from "@/services/projects/projectsService";
import { projectQueryDefaults } from "@/services/projects/queryDefaults";
import {
  ProjectsQueryKeys,
  WorkspacesQueryKeys,
} from "@/services/projects/types";
import { getWorkspace } from "@/services/projects/workspacesService";

import { resolveTeam } from "./teamResolution";
import type { TeamResolution, TeamSummary } from "./types";
import { useTeamIdentity } from "./useTeamIdentity";
import { useUserTeams } from "./useUserTeams";
import { teamOfWorkspace } from "./workspaceTeam";

function distinctTeams(teams: TeamSummary[]): TeamSummary[] {
  return teams.filter(
    (team, index) =>
      teams.findIndex((candidate) => candidate.id === team.id) === index,
  );
}

export function useTeamForProjects(
  projectIds: readonly string[],
): TeamResolution {
  const { configured, available } = useBackend();
  const enabled =
    configured &&
    available &&
    getTeamImpersonationHeaderName() !== null &&
    projectIds.length > 0;

  const projects = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: ProjectsQueryKeys.Id(id),
      queryFn: () => getProject(id),
      enabled,
      ...projectQueryDefaults,
    })),
  });
  const reachableProjects = projects.filter(
    (project) => !isProjectGone(project.error),
  );

  const workspaceIds = [
    ...new Set(
      reachableProjects.flatMap((project) =>
        project.data ? [project.data.workspaceId] : [],
      ),
    ),
  ];
  const workspaces = useQueries({
    queries: workspaceIds.map((id) => ({
      queryKey: WorkspacesQueryKeys.Id(id),
      queryFn: () => getWorkspace(id),
      enabled,
      ...projectQueryDefaults,
    })),
  });

  const teams = distinctTeams(
    workspaces.flatMap((workspace) => {
      const team = workspace.data ? teamOfWorkspace(workspace.data) : null;
      return team ? [team] : [];
    }),
  );
  const candidate = teams.length === 1 ? teams[0] : undefined;

  const memberships = useUserTeams({
    enabled: enabled && candidate !== undefined,
  });
  const isMember =
    candidate !== undefined &&
    (memberships.data ?? []).some(
      (membership) => membership.teamId === candidate.id,
    );
  const identity = useTeamIdentity(isMember ? candidate.id : undefined);

  if (!enabled) return { status: "none" };

  return resolveTeam({
    lookups: [...reachableProjects, ...workspaces],
    teams,
    memberships,
    identity,
  });
}
