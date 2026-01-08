import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
} from "@/api/types.gen";
import {
  fetchExecutionDetails,
  fetchExecutionState,
} from "@/services/executionService";

import type { ComponentSpec, TaskSpec } from "./componentSpec";
import { isGraphImplementation } from "./componentSpec";
import { ROOT_TASK_ID } from "./constants";
import { getOverallExecutionStatusFromStats } from "./executionStatus";
import { isSubgraph } from "./subgraphUtils";

export interface TaskStatusInfo {
  taskId: string;
  taskName: string;
  status: string;
  subgraphPath: string[];
  /** Execution ID of the innermost subgraph containing this task (for URL navigation) */
  parentExecutionId?: string;
}

interface CollectContext {
  subgraphPath: string[];
  visitedSpecs: Set<ComponentSpec>;
  executionState?: GetGraphExecutionStateResponse;
  executionDetails?: GetExecutionInfoResponse;
  backendUrl: string;
  /** Execution ID of the current subgraph level */
  currentExecutionId?: string;
}

const getTaskDisplayName = (taskId: string, taskSpec: TaskSpec): string => {
  return (
    taskSpec.componentRef?.spec?.name ?? taskSpec.componentRef?.name ?? taskId
  );
};

/**
 * Recursively collects all LEAF tasks (non-subgraph tasks) with their execution statuses.
 * This traverses into subgraphs to find the actual tasks.
 */
export const collectAllTaskStatuses = async (
  componentSpec: ComponentSpec,
  executionState: GetGraphExecutionStateResponse | undefined,
  executionDetails: GetExecutionInfoResponse | undefined,
  backendUrl: string,
  rootExecutionId?: string,
): Promise<TaskStatusInfo[]> => {
  return collectTasksRecursive(componentSpec, {
    subgraphPath: [ROOT_TASK_ID],
    visitedSpecs: new Set(),
    executionState,
    executionDetails,
    backendUrl,
    currentExecutionId: rootExecutionId,
  });
};

const collectTasksRecursive = async (
  componentSpec: ComponentSpec,
  context: CollectContext,
): Promise<TaskStatusInfo[]> => {
  if (context.visitedSpecs.has(componentSpec)) {
    return [];
  }
  context.visitedSpecs.add(componentSpec);

  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const tasks = componentSpec.implementation.graph.tasks;
  const results: TaskStatusInfo[] = [];

  for (const [taskId, taskSpec] of Object.entries(tasks)) {
    const isSubgraphTask = isSubgraph(taskSpec);

    if (isSubgraphTask && taskSpec.componentRef?.spec) {
      const subgraphExecutionId =
        context.executionDetails?.child_task_execution_ids?.[taskId];

      let nestedState: GetGraphExecutionStateResponse | undefined;
      let nestedDetails: GetExecutionInfoResponse | undefined;

      if (subgraphExecutionId && context.backendUrl) {
        try {
          [nestedDetails, nestedState] = await Promise.all([
            fetchExecutionDetails(subgraphExecutionId, context.backendUrl),
            fetchExecutionState(subgraphExecutionId, context.backendUrl),
          ]);
        } catch {
          // If fetching fails, continue without nested execution data
        }
      }

      const nestedResults = await collectTasksRecursive(
        taskSpec.componentRef.spec,
        {
          subgraphPath: [...context.subgraphPath, taskId],
          visitedSpecs: context.visitedSpecs,
          executionState: nestedState,
          executionDetails: nestedDetails,
          backendUrl: context.backendUrl,
          currentExecutionId: subgraphExecutionId,
        },
      );
      results.push(...nestedResults);
    } else {
      const executionId =
        context.executionDetails?.child_task_execution_ids?.[taskId];
      const statusStats =
        context.executionState?.child_execution_status_stats?.[
          executionId ?? ""
        ];
      const status =
        getOverallExecutionStatusFromStats(statusStats) ?? "UNKNOWN";

      results.push({
        taskId,
        taskName: getTaskDisplayName(taskId, taskSpec),
        status,
        subgraphPath: context.subgraphPath,
        parentExecutionId: context.currentExecutionId,
      });
    }
  }

  return results;
};
