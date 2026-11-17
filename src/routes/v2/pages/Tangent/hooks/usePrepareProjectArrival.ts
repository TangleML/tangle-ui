import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import {
  readTangentOpenParam,
  readTangentSessionParam,
  withoutTangentArrivalSearch,
  withoutTangentOpenSearch,
} from "@/routes/tangentSearch";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { createAndAttachPipeline } from "@/services/projects/createAndAttachPipeline";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import {
  pipelineFileTarget,
  remoteResourceTarget,
} from "@/services/projects/pipelineResource";
import { MAX_PAGE_SIZE } from "@/services/projects/queryDefaults";
import {
  describeResource,
  LOCAL_PIPELINE,
  PIPELINE_RUN,
} from "@/services/projects/resourceDescriptor";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  readStartingSession,
  withoutStartingSession,
} from "@/services/projects/startingSession";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import {
  useProject,
  useUpdateProjectMetadata,
} from "@/services/projects/useProjects";
import { getErrorMessage } from "@/utils/string";

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

function oldestAttached(
  resources: readonly ProjectResourceSummary[],
  type: string,
) {
  return oldestFirst(resources).flatMap((resource) => {
    const described = describeResource(resource);
    const remote =
      type === LOCAL_PIPELINE ? remoteResourceTarget(resource) : undefined;
    if (remote) return [{ resource, target: remote }];
    return described?.type === type && described.target
      ? [{ resource, target: described.target }]
      : [];
  })[0];
}

/**
 * A session someone asked for elsewhere — the dashboard's prompt box, Debug in
 * Tangent, a link asking for one — is started however many sessions the project
 * already holds: the ask was made once, and would otherwise be dropped on every
 * project but an empty one. Only the rest of the arrival is gated on emptiness,
 * so a project someone has worked in comes up as they left it. A link's ask is
 * for an empty session, so it drops a prompt still waiting on the project
 * rather than running a request that was never made through the link.
 *
 * A session nobody typed into is detached again on unmount, so an untouched new
 * project arrives session-less a second time. Reusing the pipeline or run
 * attached last time is what stops that adding a pipeline.
 *
 * The sequence is one mutation so `isPending` guards all of it, and the
 * pipeline opens only after `startSession` resolves, so a session that fails
 * to start leaves the project as it was. The ref holds the store it prepared,
 * so moving to another project in place (a new store, same mount) arrives
 * there too. It also guards what `isPending` cannot:
 * StrictMode replays this effect inside one commit, where the closure's
 * `isPending` has not yet seen the first `mutate`.
 */
export function usePrepareProjectArrival(
  store: TangentProjectStore,
  { projectId, sessionCount, isSessionsLoading }: PrepareProjectArrivalOptions,
) {
  const storage = usePipelineStorage();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { data: project, isFetching: isProjectFetching } =
    useProject(projectId);
  const { data: documents } = useProjectResources(projectId, {
    entity: ["document", "pipeline"],
    pageSize: MAX_PAGE_SIZE,
  });
  const { mutateAsync: createResource } = useCreateProjectResource(projectId);
  const { mutateAsync: updateProjectMetadata } = useUpdateProjectMetadata();
  const { isConfigured: isAiConfigured } = useAiProviderSettings();
  const prepared = useRef<TangentProjectStore | null>(null);

  const linkAsksForSession = readTangentSessionParam(search)?.kind === "new";
  const waiting = readStartingSession(project?.metadata);
  const starting = linkAsksForSession ? undefined : waiting;
  const askedFor = starting ? nameFromPrompt(starting.prompt) : undefined;
  const isEmpty = sessionCount === 0;
  const linkAsksToOpen = readTangentOpenParam(search);

  const { mutate, isPending } = useMutation({
    mutationFn: async (askedToOpen: WorkareaTarget | undefined) => {
      const started = await store.startSession(
        starting && { ...starting, name: askedFor },
      );
      if (!started) return;

      // Taking the ask back off the project, whether it ran or a link dropped
      // it, is housekeeping that stops the next arrival repeating it. The
      // session has already started, so a refusal here must not cost the
      // caller the pipeline and the workarea they came for — it is left for
      // the next arrival to try again.
      if (waiting) {
        try {
          await updateProjectMetadata({
            id: projectId,
            change: withoutStartingSession,
          });
        } catch (error) {
          console.error(
            "Failed to clear the project's starting session",
            error,
          );
        }
      }

      if (askedToOpen) {
        await store.openWorkareaTarget(askedToOpen);
        return;
      }

      if (!isEmpty) return;

      const attached =
        oldestAttached(documents?.items ?? [], LOCAL_PIPELINE) ??
        oldestAttached(documents?.items ?? [], PIPELINE_RUN);

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

      const target: WorkareaTarget = pipelineFileTarget(file);
      await store.openWorkareaTarget(target, file.storageKey);
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });

  const knowsWhetherToArrive =
    !isSessionsLoading && project !== undefined && !isProjectFetching;
  const asksForArrival =
    isEmpty || starting !== undefined || linkAsksForSession;

  // A session started without a provider cannot be spoken to, and the opening
  // prompt would be spent on it. Leave the project as it is, so setting a
  // provider up and coming back still gets the arrival it was meant to have.
  const hasArrival =
    knowsWhetherToArrive &&
    asksForArrival &&
    isAiConfigured &&
    documents !== undefined;
  const dropsOpenAsk =
    knowsWhetherToArrive && !asksForArrival && linkAsksToOpen !== undefined;

  useEffect(() => {
    if (!dropsOpenAsk) return;
    void navigate({
      to: ".",
      search: withoutTangentOpenSearch,
      replace: true,
    } as never);
  }, [dropsOpenAsk, navigate]);

  useEffect(() => {
    if (!hasArrival || prepared.current === store) return;
    if (isPending || store.isStartingSession) return;
    prepared.current = store;
    mutate(linkAsksToOpen);

    if (linkAsksForSession || linkAsksToOpen) {
      void navigate({
        to: ".",
        search: withoutTangentArrivalSearch,
        replace: true,
      } as never);
    }
  }, [
    hasArrival,
    isPending,
    store,
    mutate,
    linkAsksForSession,
    linkAsksToOpen,
    navigate,
  ]);
}
