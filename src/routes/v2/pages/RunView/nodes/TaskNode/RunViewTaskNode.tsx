import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { StatusIndicator } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import Logs from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TaskNode } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { useTaskRunStatus } from "./useTaskRunStatus";

type TaskNodeType = Node<TaskNodeData, "task">;

export const RunViewTaskNode = observer(function RunViewTaskNode(
  props: NodeProps<TaskNodeType>,
) {
  const { entityId } = props.data;
  const { windows } = useSharedStores();
  const { task, status, disabledCache, executionId, showLogsButton } =
    useTaskRunStatus(entityId);

  const handleOpenLogs = () => {
    if (!task || !executionId) return;
    windows.openWindow(<Logs executionId={executionId} status={status} />, {
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
