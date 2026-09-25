import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import {
  describeResource,
  LOCAL_PIPELINE,
  localPipelineResourceInput,
} from "@/services/projects/resourceDescriptor";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import { idIdentity } from "@/services/projects/resourceTarget";
import {
  readStartingSession,
  withoutStartingSession,
} from "@/services/projects/startingSession";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { useProject, useUpdateProject } from "@/services/projects/useProjects";

import { PROJECT_DETAILS_WINDOW_ID } from "./tangentProjectWindowOrder";

interface PrepareProjectArrivalOptions {
  projectId: string;
  sessionCount: number;
  isSessionsLoading: boolean;
}

function oldestFirst(resources: readonly ProjectResourceSummary[]) {
  return [...resources].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
}

/**
 * What arriving at a project does. A project carrying a session someone asked
 * for elsewhere — the dashboard's prompt box, Debug in Tangent — starts it,
 * however many sessions the project already holds; the ask was made once and
 * would otherwise be dropped on every project but an empty one.
 *
 * A project with no sessions gets the rest as well: a pipeline opened beside
 * the session to work in — created and attached to the project first if it has
 * none — and the project window folded away. Those ask only whether the project
 * has nothing, so a project someone has already worked in comes up as they left
 * it, project window included.
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
export function usePrepareProjectArrival(
  store: TangentProjectStore,
  { projectId, sessionCount, isSessionsLoading }: PrepareProjectArrivalOptions,
) {
  const storage = usePipelineStorage();
  const { windows } = useSharedStores();
  const { data: project } = useProject(projectId);
  const { data: documents } = useProjectResources(projectId, {
    entity: ["document"],
  });
  const { mutateAsync: createResource } = useCreateProjectResource(projectId);
  const { mutateAsync: updateProject } = useUpdateProject();
  const { isConfigured: isAiConfigured } = useAiProviderSettings();
  const prepared = useRef(false);

  const starting = readStartingSession(project?.extraData);
  const askedFor = starting ? nameFromPrompt(starting.prompt) : undefined;
  const isEmpty = sessionCount === 0;

  const { mutate, isIdle } = useMutation({
    mutationFn: async () => {
      const started = await store.startSession(
        starting && { ...starting, name: askedFor },
      );
      if (!started) return;

      if (starting) {
        await updateProject({
          id: projectId,
          input: { extraData: withoutStartingSession(project?.extraData) },
        });
      }

      if (!isEmpty) return;

      // Nothing has been written about a project nobody has worked in yet, so
      // its window is a tall empty form sitting above the sessions and
      // resources someone arriving actually came for.
      windows.getWindowById(PROJECT_DETAILS_WINDOW_ID)?.minimize();

      const attached = oldestFirst(documents?.items ?? []).flatMap(
        (resource) => {
          const described = describeResource(resource);
          return described?.type === LOCAL_PIPELINE && described.target
            ? [{ resource, target: described.target }]
            : [];
        },
      )[0];

      if (attached) {
        await store.openWorkareaTarget(
          attached.target,
          attached.resource.name ?? undefined,
        );
        return;
      }

      // Named after the ask, which is also what the project is called, so the
      // two agree until the agent renames one. It reads as a repetition; four
      // random words read as a mistake. Nothing asked for, nothing to name it
      // after, so it keeps the random words — which nobody chose either.
      const file = await createNewPipeline(
        storage,
        askedFor ? await availablePipelineName(askedFor) : undefined,
        { provisionalName: true },
      );
      await createResource(
        localPipelineResourceInput({
          localName: file.storageKey,
          localId: file.id,
        }),
      );

      const target: WorkareaTarget = {
        type: "pipeline",
        identity: idIdentity(file.id),
      };
      await store.openWorkareaTarget(target, file.storageKey);
    },
  });

  // A session started without a provider cannot be spoken to, and the opening
  // prompt would be spent on it. Leave the project as it is, so setting a
  // provider up and coming back still gets the arrival it was meant to have.
  const hasArrival =
    !isSessionsLoading &&
    (isEmpty || starting !== undefined) &&
    isAiConfigured &&
    project !== undefined &&
    documents !== undefined;

  useEffect(() => {
    if (!hasArrival || prepared.current) return;
    if (!isIdle || store.isStartingSession) return;
    prepared.current = true;
    mutate();
  }, [hasArrival, isIdle, store]);
}
