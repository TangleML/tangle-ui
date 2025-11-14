import { useQuery } from "@tanstack/react-query";

import type {
  ContainerExecutionStatus,
  GetArtifactsApiExecutionsIdArtifactsGetResponse,
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import type {
  ExecutionStatus,
  RunStatus,
  TaskStatusCounts,
} from "@/types/pipelineRun";
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

    return processExecutionStatuses(details, stateData);
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
 * Count execution statuses from API response
 */
export const processExecutionStatuses = (
  details?: GetExecutionInfoResponse,
  state?: GetGraphExecutionStateResponse,
): ExecutionStatus => {
  const map: Record<string, ContainerExecutionStatus> = {};
  const counts = {
    total: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    waiting: 0,
    skipped: 0,
    cancelled: 0,
  };

  if (!details) {
    return {
      run: STATUS.UNKNOWN,
      map,
      counts,
    };
  }

  // If no state data is available, set all tasks to WAITING_FOR_UPSTREAM
  if (!state && details?.child_task_execution_ids) {
    Object.keys(details.child_task_execution_ids).forEach((taskId) => {
      map[taskId] = "WAITING_FOR_UPSTREAM";
      counts.waiting++;
    });

    counts.total = counts.waiting;

    return {
      run: STATUS.WAITING,
      map,
      counts,
    };
  }

  if (
    details?.child_task_execution_ids &&
    state?.child_execution_status_stats
  ) {
    Object.entries(details.child_task_execution_ids).forEach(
      ([taskId, executionId]) => {
        const executionIdStr = String(executionId);
        const statusStats = state.child_execution_status_stats[executionIdStr];

        let status: ContainerExecutionStatus = "WAITING_FOR_UPSTREAM";

        if (statusStats) {
          const initialStatus = Object.keys(statusStats)[0];
          if (isContainerExecutionStatus(initialStatus)) {
            status = initialStatus;
          }
        }

        map[taskId] = status;

        // Count the status
        switch (status) {
          case "SUCCEEDED":
            counts.succeeded++;
            break;
          case "FAILED":
          case "SYSTEM_ERROR":
          case "INVALID":
            counts.failed++;
            break;
          case "CANCELLING":
          case "SKIPPED":
            counts.skipped++;
            break;
          case "RUNNING":
            counts.running++;
            break;
          case "CANCELLED":
            counts.cancelled++;
            break;
          default:
            counts.waiting++;
            break;
        }
      },
    );
  }

  counts.total =
    counts.succeeded +
    counts.failed +
    counts.running +
    counts.waiting +
    counts.skipped +
    counts.cancelled;

  const runStatus = getRunStatus(counts);

  return {
    run: runStatus,
    map,
    counts,
  };
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

const CONTAINER_EXECUTION_STATUSES = [
  "INVALID",
  "UNINITIALIZED",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SYSTEM_ERROR",
  "CANCELLING",
  "CANCELLED",
  "SKIPPED",
] as const;

const isContainerExecutionStatus = (
  status: string,
): status is ContainerExecutionStatus => {
  return CONTAINER_EXECUTION_STATUSES.includes(
    status as ContainerExecutionStatus,
  );
};
