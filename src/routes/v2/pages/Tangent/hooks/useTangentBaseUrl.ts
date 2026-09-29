import { resolveTangentBaseUrl } from "@/routes/v2/pages/Tangent/services/tangentBaseUrl";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";

interface TangentBaseUrl {
  baseUrl: string | null;
  localAddress: string | null;
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

  // Resolved from the workspace itself rather than the loading flags: a
  // disabled workspace query reports isLoading false while still holding no
  // data, so gating on the flags would hand callers the dev fallback for a
  // render — and whatever fetched it would aim at loopback, which is what had
  // Chrome asking for local network access on the first page view.
  const resolution = workspace
    ? resolveTangentBaseUrl(workspace.metadata)
    : null;

  return {
    baseUrl: resolution?.baseUrl ?? null,
    localAddress: resolution?.localAddress ?? null,
    isLoading: isProjectLoading || isWorkspaceLoading,
    isError: isProjectError || isWorkspaceError,
  };
}
