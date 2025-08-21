import { Query, useQuery } from "@tanstack/react-query";

import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchExecutionDetails,
  fetchExecutionState,
  fetchPipelineRun,
  isStatusComplete,
  processExecutionStatuses,
} from "@/services/executionService";

const useRootExecutionId = (id: string) => {
  const { backendUrl } = useBackend();
  const { data: rootExecutionId } = useQuery({
    queryKey: ["pipeline-run-execution-id", id],
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
    enabled: !!id && id.length > 0,
    staleTime: Infinity,
  });

  return rootExecutionId;
};

/* Accepts root_execution_id or run_id and returns execution details and state */
export const usePipelineRunData = (id: string) => {
  const { backendUrl } = useBackend();

  const rootExecutionId = useRootExecutionId(id);

  const { data: executionDetails } = useQuery({
    enabled: !!rootExecutionId,
    queryKey: ["execution-details", rootExecutionId],
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
    enabled: !!rootExecutionId && !!executionDetails,
    queryKey: ["pipeline-run", rootExecutionId],
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

        const status = processExecutionStatuses(details, state);

        return isStatusComplete(status.run) ? false : 5000;
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
