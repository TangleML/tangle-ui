import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { tangentOpenSearch } from "@/routes/tangentSearch";
import { attachPipelineRunOnce } from "@/services/projects/attachPipelineRun";
import { rememberLastUsedWorkspace } from "@/services/projects/defaultWorkspace";
import { isProjectGone } from "@/services/projects/errors";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
  getProject,
  updateProject,
} from "@/services/projects/projectsService";
import { pipelineRunResourceInput } from "@/services/projects/resourceDescriptor";
import { runTarget } from "@/services/projects/resourceTarget";
import type { StartingSession } from "@/services/projects/startingSession";
import { startingSessionMetadata } from "@/services/projects/startingSession";
import type { CreateResourceInput, Project } from "@/services/projects/types";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { getErrorMessage } from "@/utils/string";

export interface RunInTangent {
  runId: string;
  pipelineName: string;
}

export type TangentDestination =
  | { kind: "existing"; projectId: string }
  | { kind: "new"; workspaceId: string; name: string };

export interface RunTangentHandoff {
  newProjectName: (run: RunInTangent) => string;
  newProjectDocuments?: (
    project: Project,
    run: RunInTangent,
  ) => CreateResourceInput[];
  startingSession?: (run: RunInTangent) => StartingSession;
}

type HandoffDestination =
  TangentDestination | { kind: "attributed"; project: Project };

interface ChoosingDestination {
  run: RunInTangent;
  attributed: Project[];
  newProjectName: string;
}

/**
 * Only a definite "not there" is dropped: a backend that merely failed to
 * answer would otherwise offer a new project beside the real one.
 */
async function projectsStillThere(projectIds: readonly string[]) {
  const found = await Promise.all(
    projectIds.map(async (projectId) => {
      try {
        return await getProject(projectId);
      } catch (error) {
        if (isProjectGone(error)) return undefined;
        throw error;
      }
    }),
  );
  return found.filter((project) => project !== undefined);
}

export function useRunTangentHandoff(handoff: RunTangentHandoff) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const rerunProjectIds = useRerunProjectIds();
  const [choosing, setChoosing] = useState<ChoosingDestination>();

  const intoExistingProject = async (project: Project, run: RunInTangent) => {
    await attachPipelineRunOnce(project.id, run);

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
      metadata: session ? startingSessionMetadata(session) : {},
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

    rememberLastUsedWorkspace(workspaceId);
    return project;
  };

  const send = useMutation({
    mutationFn: async ({
      run,
      destination,
    }: {
      run: RunInTangent;
      destination: HandoffDestination;
    }) => {
      if (destination.kind === "new") return intoNewProject(destination, run);
      const project =
        destination.kind === "attributed"
          ? destination.project
          : await getProject(destination.projectId);
      return intoExistingProject(project, run);
    },
    onSuccess: (project, { run }) => {
      void queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.All() });
      void navigate({
        to: APP_ROUTES.TANGENT_PROJECT,
        params: { projectId: project.id },
        search: tangentOpenSearch(runTarget(run.runId)),
      });
    },
    onError: (error) => {
      notify(getErrorMessage(error), "error");
    },
  });

  const lookUp = useMutation({
    mutationFn: async (run: RunInTangent) =>
      projectsStillThere(await rerunProjectIds(run.runId)),
    onSuccess: (attributed, run) => {
      if (attributed.length === 1) {
        send.mutate({
          run,
          destination: { kind: "attributed", project: attributed[0] },
        });
        return;
      }
      setChoosing({
        run,
        attributed,
        newProjectName: handoff.newProjectName(run),
      });
    },
    onError: (error) => {
      notify(getErrorMessage(error), "error");
    },
  });

  const choose = (destination: TangentDestination) => {
    if (!choosing) return;
    setChoosing(undefined);
    send.mutate({ run: choosing.run, destination });
  };

  return {
    start: lookUp.mutate,
    isPending: lookUp.isPending || send.isPending,
    choosing,
    choose,
    dismiss: () => setChoosing(undefined),
  };
}

export type RunTangentHandoffState = ReturnType<typeof useRunTangentHandoff>;
