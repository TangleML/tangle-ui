import { useQueries } from "@tanstack/react-query";
import localForage from "localforage";

import type { PipelineRunResponse } from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import { fetchPipelineRun } from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import { DB_NAME, PIPELINE_RUNS_STORE_NAME } from "@/utils/constants";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

/**
 * Fetch a run from local storage by ID
 */
async function fetchLocalRun(runId: string): Promise<PipelineRun | null> {
  const pipelineRunsDb = localForage.createInstance({
    name: DB_NAME,
    storeName: PIPELINE_RUNS_STORE_NAME,
  });

  return pipelineRunsDb.getItem<PipelineRun>(runId);
}

/**
 * Transform backend response to PipelineRun type
 */
function transformBackendResponse(response: PipelineRunResponse): PipelineRun {
  // execution_status_stats in PipelineRunResponse is already flat { status: count }
  const status = response.execution_status_stats
    ? getOverallExecutionStatusFromStats(response.execution_status_stats)
    : undefined;

  return {
    id: Number(response.id),
    root_execution_id: Number(response.root_execution_id),
    created_at: response.created_at ?? "",
    created_by: response.created_by ?? "",
    pipeline_name: response.pipeline_name ?? "Unknown Pipeline",
    status,
  };
}

/**
 * Hook to fetch multiple pipeline runs by their IDs.
 * First tries to fetch from backend, falls back to local storage.
 */
export function useRunsById(runIds: string[]) {
  const { backendUrl, ready } = useBackend();

  const queries = useQueries({
    queries: runIds.map((runId) => ({
      queryKey: ["run-by-id", runId, backendUrl],
      queryFn: async (): Promise<PipelineRun | null> => {
        // Try backend first
        if (ready && backendUrl) {
          try {
            const response = await fetchPipelineRun(runId, backendUrl);
            return transformBackendResponse(response);
          } catch {
            // Backend failed, try local storage
          }
        }

        // Fallback to local storage
        return fetchLocalRun(runId);
      },
      enabled: runIds.length > 0,
      staleTime: Infinity,
      retry: false,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error;

  // Filter out null results and maintain order
  const runs: PipelineRun[] = queries
    .map((q) => q.data)
    .filter((run): run is PipelineRun => run !== null && run !== undefined);

  // Track which IDs were not found
  const notFoundIds = runIds.filter((_, index) => !queries[index]?.data);

  return {
    runs,
    isLoading,
    error,
    notFoundIds,
    isReady: !isLoading && runs.length > 0,
  };
}
