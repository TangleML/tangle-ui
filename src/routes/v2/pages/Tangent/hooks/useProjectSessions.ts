import { useQueries } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import type {
  ListProjectResourcesParams,
  ProjectResource,
  ProjectResourceSummary,
} from "@/services/projects/types";
import {
  projectResourcesQueryOptions,
  useCreateProjectResource,
  useDeleteProjectResource,
  useProjectResources,
  useUpdateProjectResource,
} from "@/services/projects/useProjectResources";

export interface ProjectSession {
  resourceId: string;
  sessionId: string;
  name: string | null;
  createdAt: Date;
}

export const SESSION_RESOURCES: ListProjectResourcesParams = {
  entity: ["agent_session"],
};

export function sessionsOf(
  resources: ProjectResourceSummary[] = [],
): ProjectSession[] {
  return resources
    .flatMap((resource) =>
      resource.entityId
        ? [
            {
              resourceId: resource.id,
              sessionId: resource.entityId,
              name: resource.name,
              createdAt: resource.createdAt,
            },
          ]
        : [],
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * A session attaches to a project as a resource row carrying its id, so these
 * are the generic resource reads and writes narrowed to that entity. The row's
 * `name` is the display name; the shell keeps its own, which nothing here
 * reads.
 */
export function useProjectSessions(projectId: string) {
  const query = useProjectResources(projectId, SESSION_RESOURCES);
  const createResource = useCreateProjectResource(projectId);
  const deleteResource = useDeleteProjectResource(projectId);
  const updateResource = useUpdateProjectResource(projectId);

  const sessions = sessionsOf(query.data?.items);

  function attachSession(
    sessionId: string,
    name?: string,
  ): Promise<ProjectResource> {
    return createResource.mutateAsync({
      entity: "agent_session",
      entityId: sessionId,
      name,
    });
  }

  function detachSession(resourceId: string): Promise<void> {
    return deleteResource.mutateAsync(resourceId);
  }

  function renameSession(
    resourceId: string,
    name: string,
  ): Promise<ProjectResource> {
    return updateResource.mutateAsync({ resourceId, input: { name } });
  }

  return {
    sessions,
    isLoading: query.isLoading,
    isAttaching: createResource.isPending,
    attachSession,
    detachSession,
    renameSession,
  };
}

/**
 * The sessions of many projects at once, read from the cache each project's
 * own list fills, and only fetched while `enabled`.
 */
export function useSessionsOfProjects(
  projectIds: string[],
  enabled: boolean,
): ReadonlyMap<string, ProjectSession[]> {
  const { configured, available } = useBackend();
  const results = useQueries({
    queries: projectIds.map((projectId) => ({
      ...projectResourcesQueryOptions(projectId, SESSION_RESOURCES),
      enabled: enabled && configured && available,
    })),
  });

  return new Map(
    projectIds.map((projectId, index) => [
      projectId,
      sessionsOf(results[index]?.data?.items),
    ]),
  );
}
