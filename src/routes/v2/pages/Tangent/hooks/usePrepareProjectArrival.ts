import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { createAndAttachPipeline } from "@/services/projects/createAndAttachPipeline";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import { MAX_PAGE_SIZE } from "@/services/projects/queryDefaults";
import {
  describeResource,
  LOCAL_PIPELINE,
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
 * A session someone asked for elsewhere — the dashboard's prompt box, Debug in
 * Tangent — is started however many sessions the project already holds: the ask
 * was made once, and would otherwise be dropped on every project but an empty
 * one. Only the rest of the arrival is gated on emptiness, so a project someone
 * has worked in comes up as they left it.
 *
 * A session nobody typed into is detached again on unmount, so an untouched new
 * project arrives session-less a second time. Reusing the pipeline attached
 * last time is what stops that adding another.
 *
 * The sequence is one mutation so `isIdle` guards all of it, and the pipeline
 * opens only after `startSession` resolves, because the workarea is keyed by
 * session and a tab opened before there is one is dropped. The ref guards what
 * `isIdle` cannot: StrictMode replays this effect inside one commit, where the
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
    pageSize: MAX_PAGE_SIZE,
  });
  const { mutateAsync: createResource } = useCreateProjectResource(projectId);
  const { mutateAsync: updateProject } = useUpdateProject();
  const { isConfigured: isAiConfigured } = useAiProviderSettings();
  const prepared = useRef(false);

  const starting = readStartingSession(project?.metadata);
  const askedFor = starting ? nameFromPrompt(starting.prompt) : undefined;
  const isEmpty = sessionCount === 0;

  const { mutate, isIdle } = useMutation({
    mutationFn: async () => {
      const started = await store.startSession(
        starting && { ...starting, name: askedFor },
      );
      if (!started) return;

      // Taking the ask back off the project is housekeeping that stops the next
      // arrival repeating it. The session it asked for has already started, so
      // a refusal here must not cost the caller the pipeline and the workarea
      // they came for — it is left for the next arrival to try again.
      if (starting) {
        try {
          await updateProject({
            id: projectId,
            input: { metadata: withoutStartingSession(project?.metadata) },
          });
        } catch (error) {
          console.error(
            "Failed to clear the project's starting session",
            error,
          );
        }
      }

      if (!isEmpty) return;

      // Nothing has been written about a project nobody has worked in, so its
      // window is a tall empty form sitting above what someone came for.
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

      // Named after the ask, as the project is, so the two agree until the
      // agent renames one. Reading as a repetition beats four random words
      // reading as a mistake — which is what an unasked-for project keeps.
      const file = await createAndAttachPipeline({
        storage,
        name: askedFor,
        provisionalName: true,
        attach: createResource,
      });

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
