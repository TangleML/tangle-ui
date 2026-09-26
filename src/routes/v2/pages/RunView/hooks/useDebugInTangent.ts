import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { isProjectGone } from "@/services/projects/errors";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
  getProject,
  updateProject,
} from "@/services/projects/projectsService";
import {
  instructionsResourceInput,
  pipelineRunResourceInput,
} from "@/services/projects/resourceDescriptor";
import { startingSessionExtraData } from "@/services/projects/startingSession";
import type { Project } from "@/services/projects/types";
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
  projectId?: string;
}

/**
 * Only a definite "not there" is skipped past: a backend that merely failed to
 * answer would otherwise strand the run in a new project beside the real one.
 */
async function firstProjectStillThere(projectIds: readonly string[]) {
  for (const projectId of projectIds) {
    try {
      return await getProject(projectId);
    } catch (error) {
      if (!isProjectGone(error)) throw error;
    }
  }
  return undefined;
}

const runResourceInput = (runId: string, pipelineName: string) =>
  pipelineRunResourceInput(
    runId,
    new URL(getDefaultRunPath(runId), window.location.origin).href,
    pipelineName,
  );

export function useDebugInTangent() {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const rerunProjectIds = useRerunProjectIds();

  // The project's instructions are someone else's, and there is only ever one
  // document holding them, so the brief rides in on the opening prompt instead.
  const debugExisting = async (
    project: Project,
    { runId, pipelineName }: DebugInTangentVariables,
  ) => {
    const projectId = project.id;
    await createProjectResource(
      projectId,
      runResourceInput(runId, pipelineName),
    );
    await updateProject(projectId, {
      extraData: {
        ...(project.extraData ?? {}),
        ...startingSessionExtraData({
          prompt: buildDebugStartingPrompt(runId),
        }),
      },
    });
    return project;
  };

  const debugInNewProject = async ({
    runId,
    pipelineName,
  }: DebugInTangentVariables) => {
    const workspace = workspaces?.find((w) => w.isActive) ?? workspaces?.[0];
    if (!workspace) {
      throw new Error("No workspace is available to create a project.");
    }

    const project = await createProject({
      workspaceId: workspace.id,
      name: `Debug: ${pipelineName}`,
      origin: "agent",
      extraData: startingSessionExtraData({
        prompt: buildDebugStartingPrompt(runId),
      }),
    });

    try {
      await createProjectResource(
        project.id,
        instructionsResourceInput(buildDebugInstructions(runId, project.id)),
      );
      await createProjectResource(
        project.id,
        runResourceInput(runId, pipelineName),
      );
    } catch (error) {
      await deleteProject(project.id).catch((rollbackError) =>
        console.error("Failed to roll back debug project", rollbackError),
      );
      throw error;
    }

    return project;
  };

  const { mutate: debug, isPending } = useMutation({
    mutationFn: async (variables: DebugInTangentVariables) => {
      const attributed = variables.projectId
        ? [variables.projectId]
        : await rerunProjectIds(variables.runId);

      const existing = await firstProjectStillThere(attributed);

      return existing
        ? debugExisting(existing, variables)
        : debugInNewProject(variables);
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
