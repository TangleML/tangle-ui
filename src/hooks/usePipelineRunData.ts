import { Query, useQuery } from "@tanstack/react-query";

import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { useBackend } from "@/providers/BackendProvider";
import {
  countTaskStatuses,
  fetchExecutionDetails,
  fetchExecutionState,
  fetchPipelineRun,
  getRunStatus,
  isStatusComplete,
} from "@/services/executionService";
import { BACKEND_QUERY_KEY } from "@/utils/constants";

const useRootExecutionId = (id: string) => {
  const { backendUrl, configured } = useBackend();
  const { data: rootExecutionId } = useQuery({
    queryKey: [BACKEND_QUERY_KEY, "pipeline-run-execution-id", id],
    queryFn: async () => {
      const rootExecutionId = await fetchPipelineRun(id, backendUrl)
        .then((res) => res.root_execution_id)
        .catch((_) => undefined);

      if (rootExecutionId) {
        return rootExecutionId;
      }

      // assuming id is root_execution_id
      return id;
    },
    enabled: !!id && id.length > 0 && configured,
    staleTime: Infinity,
  });

  return rootExecutionId;
};

/* Accepts root_execution_id or run_id and returns execution details and state */
export const usePipelineRunData = (id: string) => {
  const { backendUrl, configured } = useBackend();

  const rootExecutionId = useRootExecutionId(id);

  const { data: executionDetails } = useQuery({
    enabled: !!rootExecutionId && configured,
    queryKey: [BACKEND_QUERY_KEY, "execution-details", rootExecutionId],
    queryFn: async () => {
      if (!rootExecutionId) {
        throw new Error("No root execution id found");
      }

      return fetchExecutionDetails(rootExecutionId, backendUrl);
    },
    staleTime: 1 * HOURS,
  });

  const {
    data: executionData,
    error,
    isLoading,
  } = useQuery({
    enabled: !!rootExecutionId && !!executionDetails && configured,
    queryKey: [BACKEND_QUERY_KEY, "pipeline-run", rootExecutionId],
    queryFn: async () => {
      if (!rootExecutionId) {
        throw new Error("No root execution id found");
      }

      const state = await fetchExecutionState(rootExecutionId, backendUrl);

      return {
        details: executionDetails,
        state,
      };
    },
    refetchInterval: (data) => {
      if (data instanceof Query) {
        const { details, state } = data.state.data || {};
        if (!details || !state) {
          return false;
        }
        const statusCounts = countTaskStatuses(details, state);
        const status = getRunStatus(statusCounts);

        return isStatusComplete(status) ? false : 5000;
      }
      return false;
    },
    staleTime: 5000,
  });

  return {
    executionData,
    rootExecutionId,
    isLoading,
    error,
  };
};
