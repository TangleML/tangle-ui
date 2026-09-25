import type { ProjectResource } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";

export interface ProjectSession {
  resourceId: string;
  sessionId: string;
  createdAt: Date;
}

/**
 * Thin `agent_session` wrapper over the generic project-resources client. A
 * Tangent session attaches to a project as a `project_resource` row with
 * `entity = "agent_session"` and `entity_id = <sessionId>`; this hook surfaces
 * those rows as `ProjectSession`s (newest first) and the attach/detach
 * mutations to write them.
 */
export function useProjectSessions(projectId: string) {
  const query = useProjectResources(projectId, { entity: ["agent_session"] });
  const createResource = useCreateProjectResource(projectId);
  const deleteResource = useDeleteProjectResource(projectId);

  const sessions: ProjectSession[] = (query.data?.items ?? [])
    .flatMap((resource) =>
      resource.entityId
        ? [
            {
              resourceId: resource.id,
              sessionId: resource.entityId,
              createdAt: resource.createdAt,
            },
          ]
        : [],
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  function attachSession(sessionId: string): Promise<ProjectResource> {
    return createResource.mutateAsync({
      entity: "agent_session",
      entityId: sessionId,
    });
  }

  function detachSession(resourceId: string): Promise<void> {
    return deleteResource.mutateAsync(resourceId);
  }

  return {
    sessions,
    isLoading: query.isLoading,
    isAttaching: createResource.isPending,
    attachSession,
    detachSession,
  };
}
