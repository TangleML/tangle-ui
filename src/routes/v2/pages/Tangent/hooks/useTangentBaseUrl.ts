import { resolveTangentBaseUrl } from "@/routes/v2/pages/Tangent/services/tangentBaseUrl";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";

interface TangentBaseUrl {
  baseUrl: string;
  isLoading: boolean;
}

export function useTangentBaseUrl(projectId: string): TangentBaseUrl {
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    project?.workspaceId,
  );

  return {
    baseUrl: resolveTangentBaseUrl(workspace?.extraData),
    isLoading: isProjectLoading || isWorkspaceLoading,
  };
}
