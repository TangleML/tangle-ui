import { useQuery } from "@tanstack/react-query";

import { getGraphExecutionStateApiExecutionsIdStateGet } from "@/api/sdk.gen";
import type {
  GetArtifactsApiExecutionsIdArtifactsGetResponse,
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import type { RunStatus, TaskStatusCounts } from "@/types/pipelineRun";
import {
  DEFAULT_RATE_LIMIT_RPS,
  TWENTY_FOUR_HOURS_IN_MS,
} from "@/utils/constants";
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
  const { backendUrl } = useBackend();

  return useQuery<PipelineRunResponse>({
    queryKey: ["pipeline-run-metadata", runId],
    queryFn: () => fetchPipelineRun(runId!, backendUrl),
    enabled: !!runId,
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
  return useQuery<GetContainerExecutionStateResponse>({
    queryKey: ["container-execution-state", executionId],
    queryFn: () => fetchContainerExecutionState(executionId!, backendUrl),
    enabled: !!executionId,
    refetchOnWindowFocus: false,
  });
};

/**
 * Experimental function to fetch execution status without fetching execution details.
 *
 * @param executionId
 * @returns
 */
export const fetchExecutionStatusLight = rateLimit(
  async (executionId: string): Promise<RunStatus> => {
    try {
      const defaultResponse = { child_execution_status_stats: {} };

      const result = await getGraphExecutionStateApiExecutionsIdStateGet({
        path: {
          id: executionId,
        },
      });

      const stateData =
        result.response.status === 200
          ? (result.data ?? defaultResponse)
          : defaultResponse;

      return getRunStatus(countTaskStatusesLight(stateData));
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

/**
 * Experimental function to count task statuses without fetching execution details.
 */
const countTaskStatusesLight = (
  stateData: GetGraphExecutionStateResponse,
): TaskStatusCounts => {
  const statusCounts = {
    total: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    pending: 0,
    waiting: 0,
    skipped: 0,
    cancelled: 0,
  };

  if (stateData.child_execution_status_stats) {
    Object.values(stateData.child_execution_status_stats).forEach(
      (statusStats) => {
        if (statusStats) {
          const childStatusCounts =
            convertExecutionStatsToStatusCounts(statusStats);
          const aggregateStatus = getRunStatus(childStatusCounts);
          const mappedStatus = mapStatus(aggregateStatus);
          statusCounts[mappedStatus as keyof TaskStatusCounts]++;
        } else {
          // If no status stats, assume waiting, likely we may receive none at all
          statusCounts.waiting++;
        }
      },
    );
  }

  const total =
    statusCounts.succeeded +
    statusCounts.failed +
    statusCounts.running +
    statusCounts.pending +
    statusCounts.waiting +
    statusCounts.skipped +
    statusCounts.cancelled;

  return { ...statusCounts, total };
};

/**
 * Status constants for determining overall run status based on task statuses.
 */
export const STATUS: Record<RunStatus, RunStatus> = {
  FAILED: "FAILED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  WAITING: "WAITING",
  CANCELLED: "CANCELLED",
  SKIPPED: "SKIPPED",
  UNKNOWN: "UNKNOWN",
} as const;

export const getRunStatus = (statusData: TaskStatusCounts): RunStatus => {
  if (statusData.cancelled > 0) {
    return STATUS.CANCELLED;
  }
  if (statusData.failed > 0) {
    return STATUS.FAILED;
  }
  if (statusData.running > 0) {
    return STATUS.RUNNING;
  }
  if (statusData.skipped > 0) {
    return STATUS.SKIPPED;
  }
  // "Pending" is a specific state in the execution system, but for overall run
  // aggregation it is still considered waiting/in-progress.
  if (statusData.waiting > 0 || statusData.pending > 0) {
    return STATUS.WAITING;
  }
  if (statusData.total > 0 && statusData.succeeded === statusData.total) {
    return STATUS.SUCCEEDED;
  }
  return STATUS.UNKNOWN;
};

export const isStatusInProgress = (status: string = "") => {
  return status === STATUS.RUNNING || status === STATUS.WAITING;
};

export const isStatusComplete = (status: string = "") => {
  return (
    status === STATUS.SUCCEEDED ||
    status === STATUS.FAILED ||
    status === STATUS.CANCELLED
  );
};

const mapStatus = (status: string) => {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
    case "SYSTEM_ERROR":
    case "INVALID":
    case "UPSTREAM_FAILED":
      return "failed";
    case "UPSTREAM_FAILED_OR_SKIPPED":
    case "SKIPPED":
      return "skipped";
    case "RUNNING":
    case "STARTING":
      return "running";
    case "PENDING":
      return "pending";
    case "CANCELLING":
    case "CANCELLED":
      return "cancelled";
    default:
      return "waiting";
  }
};

/**
 * Count task statuses from API response.
 *
 * For subgraphs with multiple task statuses, determines the aggregate status
 * using priority: CANCELLED > FAILED > RUNNING > SKIPPED > WAITING > SUCCEEDED
 */
export const countTaskStatuses = (
  details: GetExecutionInfoResponse,
  stateData: GetGraphExecutionStateResponse,
): TaskStatusCounts => {
  const statusCounts = {
    total: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    pending: 0,
    waiting: 0,
    skipped: 0,
    cancelled: 0,
  };

  if (
    details.child_task_execution_ids &&
    stateData.child_execution_status_stats
  ) {
    Object.values(details.child_task_execution_ids).forEach((executionId) => {
      const executionIdStr = String(executionId);
      const statusStats =
        stateData.child_execution_status_stats[executionIdStr];

      if (statusStats) {
        const childStatusCounts =
          convertExecutionStatsToStatusCounts(statusStats);
        const aggregateStatus = getRunStatus(childStatusCounts);
        const mappedStatus = mapStatus(aggregateStatus);
        statusCounts[mappedStatus as keyof TaskStatusCounts]++;
      } else {
        statusCounts.waiting++;
      }
    });
  }

  const total =
    statusCounts.succeeded +
    statusCounts.failed +
    statusCounts.running +
    statusCounts.pending +
    statusCounts.waiting +
    statusCounts.skipped +
    statusCounts.cancelled;

  return { ...statusCounts, total };
};

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

export const convertExecutionStatsToStatusCounts = (
  stats: { [key: string]: number } | null | undefined,
): TaskStatusCounts => {
  const statusCounts = {
    total: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    pending: 0,
    waiting: 0,
    skipped: 0,
    cancelled: 0,
  };

  if (!stats) {
    return statusCounts;
  }

  Object.entries(stats).forEach(([status, count]) => {
    const mappedStatus = mapStatus(status);
    statusCounts[mappedStatus as keyof TaskStatusCounts] += count;
  });

  const total =
    statusCounts.succeeded +
    statusCounts.failed +
    statusCounts.running +
    statusCounts.pending +
    statusCounts.waiting +
    statusCounts.skipped +
    statusCounts.cancelled;

  return { ...statusCounts, total };
};
