import type { ProjectResource } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
  useProjectResources,
  useUpdateProjectResource,
} from "@/services/projects/useProjectResources";

interface ProjectSession {
  resourceId: string;
  sessionId: string;
  name: string | null;
  createdAt: Date;
}

/**
 * Thin `agent_session` wrapper over the generic project-resources client. A
 * Tangent session attaches to a project as a `project_resource` row with
 * `entity = "agent_session"` and `entity_id = <sessionId>`; this hook surfaces
 * those rows as `ProjectSession`s (newest first) and the attach/detach/rename
 * mutations to write them. The row's `name` is the session's display name in
 * Tangle; the shell keeps its own, which nothing here reads.
 */
export function useProjectSessions(projectId: string) {
  const query = useProjectResources(projectId, { entity: ["agent_session"] });
  const createResource = useCreateProjectResource(projectId);
  const deleteResource = useDeleteProjectResource(projectId);
  const updateResource = useUpdateProjectResource(projectId);

  const sessions: ProjectSession[] = (query.data?.items ?? [])
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
