import type { GetExecutionInfoResponse, TaskSpecOutput } from "@/api/types.gen";
import {
  fetchContainerExecutionState,
  fetchExecutionDetails,
} from "@/services/executionService";
import { CONTAINER_STATUSES_PRE_LAUNCH } from "@/utils/executionStatus";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";

import { normalizeRunTimingData } from "./runTiming";
import type { RunTimingData, RunTimingTaskSource } from "./runTiming.types";

const MAX_CONCURRENT_REQUESTS = 6;
const MAX_TASK_EXECUTIONS = 250;

interface ExecutionQueueItem {
  executionId: string;
  parentExecutionId: string;
  taskId: string;
  navigationPath: string[];
  depth: number;
  taskSpec?: TaskSpecOutput;
}

interface FetchRunTimingDataOptions {
  rootDetails: GetExecutionInfoResponse;
  backendUrl: string;
  runCreatedAt?: string | null;
  signal?: AbortSignal;
  now?: number;
}

function graphTasksForExecution(
  details: GetExecutionInfoResponse,
): Record<string, TaskSpecOutput> {
  const implementation = details.task_spec.componentRef.spec?.implementation;
  return implementation && "graph" in implementation
    ? implementation.graph.tasks
    : {};
}

function isSubgraphTask(
  details: GetExecutionInfoResponse | undefined,
  fallbackTaskSpec: TaskSpecOutput | undefined,
): boolean {
  if (
    details &&
    Object.keys(details.child_task_execution_ids ?? {}).length > 0
  ) {
    return true;
  }

  const implementation =
    details?.task_spec.componentRef.spec?.implementation ??
    fallbackTaskSpec?.componentRef.spec?.implementation;
  return (
    implementation !== undefined &&
    implementation !== null &&
    "graph" in implementation
  );
}

function childQueueItems(
  details: GetExecutionInfoResponse,
  navigationPath: string[],
  depth: number,
): ExecutionQueueItem[] {
  const graphTasks = graphTasksForExecution(details);

  return Object.entries(details.child_task_execution_ids ?? {}).map(
    ([taskId, executionId]) => {
      const taskSpec = graphTasks[taskId];
      return {
        executionId,
        parentExecutionId: details.id,
        taskId,
        navigationPath,
        depth,
        taskSpec,
      };
    },
  );
}

function shouldFetchContainerState(
  details: GetExecutionInfoResponse,
  isSubgraph: boolean,
): boolean {
  if (isSubgraph) return false;
  const status = details.status_history?.at(-1)?.status;
  return !status || !CONTAINER_STATUSES_PRE_LAUNCH.has(status);
}

export async function fetchRunTimingData({
  rootDetails,
  backendUrl,
  runCreatedAt,
  signal,
  now = Date.now(),
}: FetchRunTimingDataOptions): Promise<RunTimingData> {
  let latestRootDetails = rootDetails;
  try {
    latestRootDetails = await fetchExecutionDetails(
      rootDetails.id,
      backendUrl,
      {
        signal,
      },
    );
  } catch (error) {
    if (signal?.aborted || error instanceof RemoteAuthError) throw error;
  }

  const rootName =
    latestRootDetails.task_spec.componentRef.spec?.name ?? "Pipeline Run";
  const rootChildren = childQueueItems(latestRootDetails, [rootName], 0);
  const queue = rootChildren.slice(0, MAX_TASK_EXECUTIONS);
  let truncated = rootChildren.length > MAX_TASK_EXECUTIONS;
  const sourceByExecutionId = new Map<string, RunTimingTaskSource>();
  let cursor = 0;

  const loadExecution = async (item: ExecutionQueueItem) => {
    let details: GetExecutionInfoResponse | undefined;
    try {
      details = await fetchExecutionDetails(item.executionId, backendUrl, {
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error instanceof RemoteAuthError) throw error;
      sourceByExecutionId.set(item.executionId, {
        ...item,
        inputArtifactIds: [],
        outputArtifactIds: [],
        isSubgraph: isSubgraphTask(undefined, item.taskSpec),
        loadFailed: true,
      });
      return;
    }

    const isSubgraph = isSubgraphTask(details, item.taskSpec);
    let containerState;
    if (shouldFetchContainerState(details, isSubgraph)) {
      try {
        containerState = await fetchContainerExecutionState(
          item.executionId,
          backendUrl,
          { signal },
        );
      } catch (error) {
        if (signal?.aborted || error instanceof RemoteAuthError) throw error;
      }
    }

    sourceByExecutionId.set(item.executionId, {
      ...item,
      details,
      containerState,
      inputArtifactIds: Object.values(details.input_artifacts ?? {}).map(
        (artifact) => artifact.id,
      ),
      outputArtifactIds: Object.values(details.output_artifacts ?? {}).map(
        (artifact) => artifact.id,
      ),
      isSubgraph,
    });

    if (details.child_task_execution_ids) {
      const children = childQueueItems(
        details,
        [...item.navigationPath, item.taskId],
        item.depth + 1,
      );
      const remainingCapacity = MAX_TASK_EXECUTIONS - queue.length;
      if (children.length > remainingCapacity) truncated = true;
      queue.push(...children.slice(0, Math.max(0, remainingCapacity)));
    }
  };

  const worker = async () => {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      await loadExecution(item);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_REQUESTS, queue.length) },
      worker,
    ),
  );

  const sources = queue.flatMap((item) => {
    const source = sourceByExecutionId.get(item.executionId);
    return source ? [source] : [];
  });

  return normalizeRunTimingData(sources, runCreatedAt, now, truncated);
}
