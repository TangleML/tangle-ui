import { shouldStatusHaveLogs } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import type { Task } from "@/models/componentSpec";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

interface TaskRunStatus {
  task: Task | undefined;
  status: string | undefined;
  disabledCache: boolean;
  executionId: string | undefined;
  showLogsButton: boolean;
}

function resolveStatus(
  task: Task | undefined,
  executionData: ReturnType<typeof useExecutionDataOptional>,
): string | undefined {
  if (!task) return undefined;
  return executionData?.taskExecutionStatusMap.get(task.name);
}

function resolveExecutionId(
  task: Task | undefined,
  executionData: ReturnType<typeof useExecutionDataOptional>,
): string | undefined {
  const taskName = task?.name ?? "";
  return executionData?.details?.child_task_execution_ids?.[taskName];
}

export function useTaskRunStatus(entityId: string): TaskRunStatus {
  const executionData = useExecutionDataOptional();
  const spec = useSpec();

  const task = spec?.tasks.find((t) => t.$id === entityId);
  const status = resolveStatus(task, executionData);
  const disabledCache =
    task?.executionOptions?.cachingStrategy?.maxCacheStaleness ===
    ISO8601_DURATION_ZERO_DAYS;

  const executionId = resolveExecutionId(task, executionData);
  const showLogsButton = !!executionId && shouldStatusHaveLogs(status);

  return { task, status, disabledCache, executionId, showLogsButton };
}
