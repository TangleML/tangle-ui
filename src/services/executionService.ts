import { useQuery } from "@tanstack/react-query";

import type {
  GetArtifactsApiExecutionsIdArtifactsGetResponse,
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import type { RunStatus, TaskStatusCounts } from "@/types/pipelineRun";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

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

export const fetchExecutionStatus = async (
  executionId: string,
  backendUrl: string,
) => {
  try {
    const details: GetExecutionInfoResponse = await fetchExecutionDetails(
      executionId,
      backendUrl,
    );
    const stateData: GetGraphExecutionStateResponse = await fetchExecutionState(
      executionId,
      backendUrl,
    );

    const taskStatuses = countTaskStatuses(details, stateData);
    const runStatus = getRunStatus(taskStatuses);

    return runStatus;
  } catch (error) {
    console.error(
      `Error fetching task statuses for run ${executionId}:`,
      error,
    );
    throw error;
  }
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
  if (statusData.waiting > 0) {
    return STATUS.WAITING;
  }
  if (statusData.succeeded > 0) {
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
    case "CANCELLING":
    case "SKIPPED":
      return "skipped";
    case "RUNNING":
    case "STARTING":
      return "running";
    case "CANCELLED":
      return "cancelled";
    default:
      return "waiting";
  }
};

/**
 * Count task statuses from API response
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
        const status = Object.keys(statusStats)[0];
        const mappedStatus = mapStatus(status);
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
    statusCounts.waiting +
    statusCounts.skipped +
    statusCounts.cancelled;

  return { ...statusCounts, total };
};
