import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { StatusIndicator } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TaskNode } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

import { useTaskRunStatus } from "./useTaskRunStatus";

type TaskNodeType = Node<TaskNodeData, "task">;

export const RunViewTaskNode = observer(function RunViewTaskNode(
  props: NodeProps<TaskNodeType>,
) {
  const { entityId } = props.data;
  const { editor } = useSharedStores();
  const {
    task,
    status,
    disabledCache,
    showLogsButton,
    subgraphExecutionStats,
  } = useTaskRunStatus(entityId);

  const handleOpenLogs = () => {
    if (!task || task.subgraphSpec) return;
    editor.selectNode(entityId, "task");
    editor.setPendingTaskDetailTab("logs");
  };

  return (
    <div className="relative">
      {!!status && (
        <StatusIndicator status={status} disabledCache={disabledCache} />
      )}
      {showLogsButton && (
        // `dark:bg-card` overrides the outline variant's translucent dark fill,
        // which let the canvas show through the button.
        <Button
          onClick={handleOpenLogs}
          variant="outline"
          size="sm"
          className="absolute -top-8 right-0 dark:bg-card"
          {...tracking("v2.run_view.canvas.task_node_open_logs")}
        >
          <Icon name="ScrollText" size="xs" />
          Open Logs
        </Button>
      )}

      <TaskNode
        {...props}
        subgraphExecutionStats={subgraphExecutionStats}
        publishedComponentBadgeReadOnly
      />
    </div>
  );
});
