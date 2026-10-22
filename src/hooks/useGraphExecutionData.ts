import { useQuery } from "@tanstack/react-query";

import type { GetGraphExecutionStateResponse } from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchExecutionDetails,
  fetchExecutionState,
} from "@/services/executionService";
import { HOURS } from "@/utils/constants";
import {
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";

const NUM_RETRIES = 3;

const retryUnlessAuth = (failureCount: number, error: Error) =>
  !(error instanceof RemoteAuthError) && failureCount < NUM_RETRIES;

/** Server state for one graph execution, shared by root and nested run views. */
export const useGraphExecutionData = (executionId: string | undefined) => {
  const { backendUrl } = useBackend();

  const details = useQuery({
    enabled: !!executionId,
    queryKey: ["execution-details", backendUrl, executionId],
    queryFn: () => fetchExecutionDetails(executionId!, backendUrl),
    staleTime: HOURS,
    retry: retryUnlessAuth,
  });

  const state = useQuery<GetGraphExecutionStateResponse>({
    enabled: !!executionId && !!details.data,
    queryKey: ["execution-state", backendUrl, executionId],
    queryFn: () => fetchExecutionState(executionId!, backendUrl),
    refetchInterval: (query) => {
      if (!query.state.data) return false;
      const stats = flattenExecutionStatusStats(
        query.state.data.child_execution_status_stats,
      );
      return isExecutionComplete(stats) ? false : 5000;
    },
    staleTime: 5000,
    retry: retryUnlessAuth,
  });

  return {
    details: details.data,
    state: state.data,
    isLoading: details.isLoading || state.isLoading,
    error: details.error ?? state.error,
  };
};
