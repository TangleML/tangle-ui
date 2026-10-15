import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { attachPipelineRunOnce } from "@/services/projects/attachPipelineRun";
import {
  pickDefaultWorkspace,
  readLastUsedWorkspaceId,
} from "@/services/projects/defaultWorkspace";
import { isProjectGone } from "@/services/projects/errors";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
  getProject,
  updateProject,
} from "@/services/projects/projectsService";
import { pipelineRunResourceInput } from "@/services/projects/resourceDescriptor";
import type { StartingSession } from "@/services/projects/startingSession";
import { startingSessionMetadata } from "@/services/projects/startingSession";
import type { CreateResourceInput, Project } from "@/services/projects/types";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { getErrorMessage } from "@/utils/string";

export interface RunInTangent {
  runId: string;
  pipelineName: string;
}

interface HandoffVariables extends RunInTangent {
  projectId?: string;
}

type TangentDestination =
  | { kind: "existing"; project: Project }
  | { kind: "new"; workspaceId: string; name: string };

export interface RunTangentHandoff {
  newProjectName: (run: RunInTangent) => string;
  newProjectMetadata?: Record<string, unknown>;
  newProjectDocuments?: (
    project: Project,
    run: RunInTangent,
  ) => CreateResourceInput[];
  startingSession?: (run: RunInTangent) => StartingSession;
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

export function useRunTangentHandoff(handoff: RunTangentHandoff) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const rerunProjectIds = useRerunProjectIds();

  const resolveDestination = async ({
    runId,
    pipelineName,
    projectId,
  }: HandoffVariables): Promise<TangentDestination> => {
    const attributed = projectId ? [projectId] : await rerunProjectIds(runId);
    const existing = await firstProjectStillThere(attributed);
    if (existing) return { kind: "existing", project: existing };

    const workspace = pickDefaultWorkspace(
      workspaces ?? [],
      readLastUsedWorkspaceId(),
    );
    if (!workspace) {
      throw new Error("No workspace is available to create a project.");
    }
    return {
      kind: "new",
      workspaceId: workspace.id,
      name: handoff.newProjectName({ runId, pipelineName }),
    };
  };

  const intoExistingProject = async (project: Project, run: RunInTangent) => {
    await attachPipelineRunOnce(project.id, run.runId, run.pipelineName);

    const session = handoff.startingSession?.(run);
    if (session) {
      await updateProject(project.id, {
        metadata: {
          ...(project.metadata ?? {}),
          ...startingSessionMetadata(session),
        },
      });
    }
    return project;
  };

  const intoNewProject = async (
    { workspaceId, name }: { workspaceId: string; name: string },
    run: RunInTangent,
  ) => {
    const session = handoff.startingSession?.(run);
    const project = await createProject({
      workspaceId,
      name,
      origin: "agent",
      metadata: {
        ...handoff.newProjectMetadata,
        ...(session ? startingSessionMetadata(session) : {}),
      },
    });

    try {
      for (const document of handoff.newProjectDocuments?.(project, run) ??
        []) {
        await createProjectResource(project.id, document);
      }
      await createProjectResource(
        project.id,
        pipelineRunResourceInput(run.runId, run.pipelineName),
      );
    } catch (error) {
      await deleteProject(project.id).catch((rollbackError) =>
        console.error(
          "Failed to roll back the project made for a run",
          rollbackError,
        ),
      );
      throw error;
    }

    return project;
  };

  const { mutate: start, isPending } = useMutation({
    mutationFn: async (variables: HandoffVariables) => {
      const run = {
        runId: variables.runId,
        pipelineName: variables.pipelineName,
      };
      const destination = await resolveDestination(variables);
      return destination.kind === "existing"
        ? intoExistingProject(destination.project, run)
        : intoNewProject(destination, run);
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

  return { start, isPending };
}
