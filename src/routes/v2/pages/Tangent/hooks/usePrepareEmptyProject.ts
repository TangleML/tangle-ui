import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";
import { idIdentity } from "@/routes/v2/pages/Tangent/workarea/workareaTarget";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { useProject, useUpdateProject } from "@/services/projects/useProjects";

import {
  browserPipelineTarget,
  starterPipelineResourceInput,
} from "./starterPipelineResource";

const DEBUG_SESSION_NAME = "Debug session";

interface PrepareEmptyProjectOptions {
  projectId: string;
  sessionCount: number;
  isSessionsLoading: boolean;
}

function readStartingPrompt(
  extraData: Record<string, unknown> | null | undefined,
): string | undefined {
  const value = extraData?.startingPrompt;
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function oldestFirst(resources: readonly ProjectResourceSummary[]) {
  return [...resources].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
}

/**
 * A project with no sessions gets one started on arrival, and a pipeline opened
 * beside it to work in — created and attached to the project first if it has
 * none. Both halves ask only whether the project has nothing, so a project
 * someone has already worked in comes up as they left it.
 *
 * A session nobody typed into is detached again on unmount, so an untouched new
 * project arrives session-less a second time and is set up again. Finding the
 * pipeline it attached last time is what stops that adding another.
 *
 * The whole sequence is one mutation so `isIdle` guards all of it, and the
 * pipeline opens only after `startSession` resolves: the workarea is keyed by
 * session, and a tab opened before there is one is dropped. The ref guards what
 * `isIdle` cannot — StrictMode replays this effect inside one commit, where the
 * closure's `isIdle` has not yet seen the first `mutate`.
 */
export function usePrepareEmptyProject(
  store: TangentProjectStore,
  { projectId, sessionCount, isSessionsLoading }: PrepareEmptyProjectOptions,
) {
  const storage = usePipelineStorage();
  const { data: project } = useProject(projectId);
  const { data: documents } = useProjectResources(projectId, {
    entity: ["document"],
  });
  const { mutateAsync: createResource } = useCreateProjectResource(projectId);
  const { mutateAsync: updateProject } = useUpdateProject();
  const prepared = useRef(false);

  const startingPrompt = readStartingPrompt(project?.extraData);

  const { mutate, isIdle } = useMutation({
    mutationFn: async () => {
      const started = await store.startSession(
        startingPrompt
          ? { prompt: startingPrompt, name: DEBUG_SESSION_NAME }
          : undefined,
      );
      if (!started) return;

      if (startingPrompt) {
        const nextExtraData = { ...(project?.extraData ?? {}) };
        delete nextExtraData.startingPrompt;
        await updateProject({
          id: projectId,
          input: { extraData: nextExtraData },
        });
      }

      const attached = oldestFirst(documents?.items ?? []).flatMap(
        (resource) => {
          const target = browserPipelineTarget(resource);
          return target ? [{ resource, target }] : [];
        },
      )[0];

      if (attached) {
        await store.openWorkareaTarget(
          attached.target,
          attached.resource.name ?? undefined,
        );
        return;
      }

      const name = await availablePipelineName(
        project?.name ?? "Untitled pipeline",
      );
      const file = await createNewPipeline(storage, name);
      await createResource(starterPipelineResourceInput(file));

      const target: WorkareaTarget = {
        type: "pipeline",
        identity: idIdentity(file.id),
      };
      await store.openWorkareaTarget(target, file.storageKey);
    },
  });

  const isEmptyProject =
    !isSessionsLoading &&
    sessionCount === 0 &&
    project !== undefined &&
    documents !== undefined;

  useEffect(() => {
    if (!isEmptyProject || prepared.current) return;
    if (!isIdle || store.isStartingSession) return;
    prepared.current = true;
    mutate();
  }, [isEmptyProject, isIdle, store]);
}
