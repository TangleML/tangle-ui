import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { pipelineRunResourceExtraData } from "@/routes/v2/pages/Tangent/workarea/resourceExtraData";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
} from "@/services/projects/projectsService";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { getErrorMessage } from "@/utils/string";

import {
  buildDebugInstructions,
  buildDebugStartingPrompt,
} from "./debugInTangentPrompts";

interface DebugInTangentVariables {
  runId: string;
  pipelineName: string;
}

export function useDebugInTangent() {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();

  const { mutate: debug, isPending } = useMutation({
    mutationFn: async ({ runId, pipelineName }: DebugInTangentVariables) => {
      const workspace = workspaces?.find((w) => w.isActive) ?? workspaces?.[0];
      if (!workspace) {
        throw new Error("No workspace is available to create a project.");
      }

      const project = await createProject({
        workspaceId: workspace.id,
        name: `Debug: ${pipelineName}`,
        origin: "agent",
        notes: buildDebugInstructions(runId),
        extraData: { startingPrompt: buildDebugStartingPrompt(runId) },
      });

      try {
        const url = new URL(getDefaultRunPath(runId), window.location.origin)
          .href;
        await createProjectResource(project.id, {
          entity: "document",
          name: pipelineName,
          extraData: pipelineRunResourceExtraData(runId, url),
          payload: {},
        });
      } catch (error) {
        await deleteProject(project.id).catch(() => undefined);
        throw error;
      }

      return project;
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.All() });
      void navigate({
        to: APP_ROUTES.TANGENT_PROJECT,
        params: { projectId: project.id },
      });
    },
    onError: (error) => {
      notify(getErrorMessage(error), "error");
    },
  });

  return { debug, isPending };
}
