import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { APP_ROUTES } from "@/routes/appRoutes";
import { getProject } from "@/services/projects/projectsService";
import { projectQueryDefaults } from "@/services/projects/queryDefaults";
import {
  ProjectsQueryKeys,
  WorkspacesQueryKeys,
} from "@/services/projects/types";
import { getWorkspace } from "@/services/projects/workspacesService";

/**
 * Moves to another project in place. The page resolves a project's Tangent url
 * from its record and workspace, and shows a loading screen until both are in
 * hand, so they are fetched first: by the time the url changes the page has
 * what it needs and only the content swaps.
 */
export function useOpenTangentProject() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async (projectId: string, search: Record<string, string>) => {
    try {
      const project = await queryClient.ensureQueryData({
        queryKey: ProjectsQueryKeys.Id(projectId),
        queryFn: () => getProject(projectId),
        ...projectQueryDefaults,
      });
      await queryClient.ensureQueryData({
        queryKey: WorkspacesQueryKeys.Id(project.workspaceId),
        queryFn: () => getWorkspace(project.workspaceId),
        ...projectQueryDefaults,
      });
    } catch {
      // The page reports a project it cannot load, so moving there anyway is
      // what tells the user why.
    }

    await navigate({
      to: APP_ROUTES.TANGENT_PROJECT,
      params: { projectId },
      search,
    });
  };
}
