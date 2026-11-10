import type { QueryClient } from "@tanstack/react-query";
import {
  queryOptions,
  useInfiniteQuery,
  useQueries,
  useQuery,
} from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import {
  type ExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";
import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";

import { isSettledRefusal } from "../retryPolicy";
import { ApiError } from "./errors";
import { getRunExecutionStats, listProjectRuns } from "./projectRunsService";
import { projectQueryDefaults } from "./queryDefaults";
import { ProjectRunsQueryKeys } from "./types";

const RUN_POLL_MS = 5000;

/**
 * A project's run feed is stale for five minutes and does not refetch on focus,
 * so a run has to announce itself to the project it was started in. Both the
 * submitter and the agent's bridge start runs, and both come through here.
 */
export async function invalidateProjectRunQueries(
  queryClient: QueryClient,
  annotations: Record<string, unknown> | null | undefined,
) {
  await Promise.all(
    projectIdsFromAnnotations(annotations).map((projectId) =>
      queryClient.invalidateQueries({
        queryKey: ProjectRunsQueryKeys.All(projectId),
      }),
    ),
  );
}

/**
 * The backend's settled "no" for a run, such as one that was deleted, which
 * asking again won't change.
 */
export function isRefusedRun(error: unknown): boolean {
  return error instanceof ApiError && isSettledRefusal(error.status);
}

/**
 * A run with no executions yet has not started rather than finished, so it
 * keeps polling: that is the "Waiting for upstream" a queued run sits in.
 */
export function runPollInterval(
  stats: ExecutionStatusStats | null | undefined,
  error?: unknown,
): number | false {
  if (isRefusedRun(error)) return false;
  return stats && isExecutionComplete(stats) ? false : RUN_POLL_MS;
}

export function useProjectRuns(projectId: string | undefined) {
  const { configured, available } = useBackend();

  return useInfiniteQuery({
    queryKey: ProjectRunsQueryKeys.List(projectId ?? ""),
    queryFn: ({ pageParam }) => {
      if (!projectId) {
        throw new Error("Project id is required");
      }
      return listProjectRuns(projectId, { pageToken: pageParam });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled: configured && available && Boolean(projectId),
    ...projectQueryDefaults,
  });
}

/**
 * A run's status changes on the backend with nothing to tell this page, so it
 * is polled until the run reaches a terminal state and then left alone.
 *
 * The shared five-minute `staleTime` is overridden for the same reason: left
 * alone it serves a settled status to the next mount, which is how a completed
 * run came back still claiming to be waiting.
 */
export function runExecutionStatsQuery(
  runId: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ProjectRunsQueryKeys.Stats(runId ?? ""),
    queryFn: () => {
      if (!runId) {
        throw new Error("Run id is required");
      }
      return getRunExecutionStats(runId);
    },
    enabled: enabled && Boolean(runId),
    ...projectQueryDefaults,
    staleTime: RUN_POLL_MS,
    refetchInterval: ({ state }) => runPollInterval(state.data, state.error),
  });
}

export function useRunExecutionStats(runId: string | undefined) {
  const { configured, available } = useBackend();
  return useQuery(runExecutionStatsQuery(runId, configured && available));
}

/** {@link useRunExecutionStats} for several runs, sharing its cache and polling. */
export function useRunsExecutionStats(runIds: string[]) {
  const { configured, available } = useBackend();
  return useQueries({
    queries: runIds.map((runId) =>
      runExecutionStatsQuery(runId, configured && available),
    ),
  });
}
