import { useQuery } from "@tanstack/react-query";

import { getGraphExecutionStateApiExecutionsIdStateGet } from "@/api/sdk.gen";
import type {
  GetArtifactsApiExecutionsIdArtifactsGetResponse,
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import {
  BACKEND_QUERY_KEY,
  DEFAULT_RATE_LIMIT_RPS,
  TWENTY_FOUR_HOURS_IN_MS,
} from "@/utils/constants";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import { rateLimit } from "@/utils/rateLimit";

export const fetchExecutionState = async (
  executionId: string,
  backendUrl: string,
) => {
  const url = `${backendUrl}/api/executions/${executionId}/state`;
  return fetchWithErrorHandling(url);
};

export const fetchExecutionDetails = async (
  executionId: string,
  backendUrl: string,
): Promise<GetExecutionInfoResponse> => {
  const url = `${backendUrl}/api/executions/${executionId}/details`;
  return fetchWithErrorHandling(url);
};

export const fetchPipelineRun = async (
  runId: string,
  backendUrl: string,
): Promise<PipelineRunResponse> => {
  const response = await fetch(`${backendUrl}/api/pipeline_runs/${runId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline run: ${response.statusText}`);
  }
  return response.json();
};

export const useFetchPipelineRunMetadata = (runId: string | undefined) => {
  const { backendUrl, configured } = useBackend();

  return useQuery<PipelineRunResponse>({
    queryKey: [BACKEND_QUERY_KEY, "pipeline-run-metadata", runId],
    queryFn: () => fetchPipelineRun(runId!, backendUrl),
    enabled: !!runId && configured,
    refetchOnWindowFocus: false,
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
  });
};

const fetchContainerExecutionState = async (
  executionId: string,
  backendUrl: string,
): Promise<GetContainerExecutionStateResponse> => {
  const url = `${backendUrl}/api/executions/${executionId}/container_state`;
  return fetchWithErrorHandling(url);
};

export const useFetchContainerExecutionState = (
  executionId: string | undefined,
  backendUrl: string,
) => {
  const { configured } = useBackend();

  return useQuery<GetContainerExecutionStateResponse>({
    queryKey: [BACKEND_QUERY_KEY, "container-execution-state", executionId],
    queryFn: () => fetchContainerExecutionState(executionId!, backendUrl),
    enabled: !!executionId && configured,
    refetchOnWindowFocus: false,
  });
};

/**
 * Lightweight function to fetch execution status without fetching full execution details.
 * Returns the highest priority server status from the execution's child tasks.
 */
export const fetchExecutionStatusLight = rateLimit(
  async (executionId: string): Promise<string | undefined> => {
    try {
      const result = await getGraphExecutionStateApiExecutionsIdStateGet({
        path: {
          id: executionId,
        },
      });

      if (result.response.status !== 200 || !result.data) {
        return undefined;
      }

      const stats = flattenExecutionStatusStats(
        result.data.child_execution_status_stats,
      );
      return getOverallExecutionStatusFromStats(stats);
    } catch (error) {
      console.error(
        `Error fetching task statuses for run ${executionId}:`,
        error,
      );
      throw error;
    }
  },
  {
    rate: DEFAULT_RATE_LIMIT_RPS - 1,
    bucketSize: 1,
  },
);

export const getExecutionArtifacts = async (
  executionId: string,
  backendUrl: string,
) => {
  if (!executionId) return null;
  const response = await fetch(
    `${backendUrl}/api/executions/${executionId}/artifacts`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch artifacts: ${response.statusText}`);
  }
  return response.json() as Promise<GetArtifactsApiExecutionsIdArtifactsGetResponse>;
};
