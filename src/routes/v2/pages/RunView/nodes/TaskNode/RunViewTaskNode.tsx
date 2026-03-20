import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { StatusIndicator } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import Logs, {
  shouldStatusHaveLogs,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNode } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { openWindow } from "@/routes/v2/shared/windows/windows.actions";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

type TaskNodeType = Node<TaskNodeData, "task">;

export const RunViewTaskNode = observer(function RunViewTaskNode(
  props: NodeProps<TaskNodeType>,
) {
  const { entityId } = props.data;
  const executionData = useExecutionDataOptional();
  const spec = useSpec();

  const task = spec?.tasks.find((t) => t.$id === entityId);
  const status = task
    ? executionData?.taskExecutionStatusMap.get(task.name)
    : undefined;
  const disabledCache =
    task?.executionOptions?.cachingStrategy?.maxCacheStaleness ===
    ISO8601_DURATION_ZERO_DAYS;

  const executionId =
    executionData?.details?.child_task_execution_ids?.[task?.name ?? ""];
  const showLogsButton = !!executionId && shouldStatusHaveLogs(status);

  const handleOpenLogs = () => {
    if (!task || !executionId) return;
    openWindow(<Logs executionId={executionId} status={status} />, {
      id: `task-logs-${task.name}`,
      title: `Logs: ${task.name}`,
      size: { width: 500, height: 400 },
    });
  };

  return (
    <div className="relative">
      {!!status && (
        <StatusIndicator status={status} disabledCache={disabledCache} />
      )}
      {showLogsButton && (
        <Button
          onClick={handleOpenLogs}
          variant="outline"
          size="sm"
          className="absolute -z-1 -top-8 right-0"
        >
          <Icon name="ScrollText" size="xs" />
          Open Logs
        </Button>
      )}

      <TaskNode {...props} />
    </div>
  );
});
