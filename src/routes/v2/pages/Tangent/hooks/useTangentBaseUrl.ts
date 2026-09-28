import { resolveTangentBaseUrl } from "@/routes/v2/pages/Tangent/services/tangentBaseUrl";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";

interface TangentBaseUrl {
  baseUrl: string;
  isLoading: boolean;
  isError: boolean;
}

export function useTangentBaseUrl(projectId: string): TangentBaseUrl {
  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
  } = useProject(projectId);
  const {
    data: workspace,
    isLoading: isWorkspaceLoading,
    isError: isWorkspaceError,
  } = useWorkspace(project?.workspaceId);

  return {
    baseUrl: resolveTangentBaseUrl(workspace?.extraData),
    isLoading: isProjectLoading || isWorkspaceLoading,
    isError: isProjectError || isWorkspaceError,
  };
}
