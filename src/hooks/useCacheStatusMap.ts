import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { isGraphImplementation } from "@/utils/componentSpec";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

/**
 * Fetches container execution state for all leaf (non-subgraph) tasks in a
 * completed run and determines which used a cached result by comparing
 * the container's ended_at time against the run's created_at time.
 *
 * Returns a Set of taskIds that used cached results.
 * Only enabled when the run is complete to avoid unnecessary requests.
 */
export function useCacheStatusMap(
  details: GetExecutionInfoResponse | undefined,
  metadata: PipelineRunResponse | undefined,
  isRunComplete: boolean,
): Set<string> {
  const { backendUrl } = useBackend();
  const { currentGraphSpec } = useComponentSpec();

  const leafTaskEntries = useMemo(() => {
    if (!details?.child_task_execution_ids || !isRunComplete) return [];

    return Object.entries(details.child_task_execution_ids).filter(
      ([taskId]) => {
        const task = currentGraphSpec.tasks[taskId];
        const impl = task?.componentRef?.spec?.implementation;
        return impl && !isGraphImplementation(impl);
      },
    );
  }, [details?.child_task_execution_ids, currentGraphSpec, isRunComplete]);

  const queries = useQueries({
    queries: leafTaskEntries.map(([, executionId]) => ({
      queryKey: ["container-execution-state", executionId],
      queryFn: (): Promise<GetContainerExecutionStateResponse> =>
        fetchWithErrorHandling(
          `${backendUrl}/api/executions/${executionId}/container_state`,
        ),
      enabled: isRunComplete,
      staleTime: TWENTY_FOUR_HOURS_IN_MS,
      refetchOnWindowFocus: false,
    })),
  });

  const allSettled = queries.every((q) => !q.isLoading);
  const runCreatedAt = metadata?.created_at;

  return useMemo(() => {
    const set = new Set<string>();
    if (!allSettled || !runCreatedAt) return set;

    const createdAt = new Date(runCreatedAt);
    leafTaskEntries.forEach(([taskId], index) => {
      const endedAt = queries[index]?.data?.ended_at;
      if (endedAt && new Date(endedAt) < createdAt) {
        set.add(taskId);
      }
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queries array is unstable; allSettled gates recomputation
  }, [allSettled, leafTaskEntries, runCreatedAt]);
}
