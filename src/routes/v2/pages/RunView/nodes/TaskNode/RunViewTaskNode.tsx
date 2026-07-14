import { useQuery } from "@tanstack/react-query";
import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { StatusIndicator } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import Logs from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useBackend } from "@/providers/BackendProvider";
import { OutputActionsProvider } from "@/routes/v2/shared/nodes/TaskNode/OutputActionsContext";
import {
  TaskNode,
  type TaskNodeOutput,
} from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { getExecutionArtifacts } from "@/services/executionService";
import { tracking } from "@/utils/tracking";

import { RunViewOutputPreview } from "./RunViewOutputPreview";
import { useTaskRunStatus } from "./useTaskRunStatus";

type TaskNodeType = Node<TaskNodeData, "task">;

export const RunViewTaskNode = observer(function RunViewTaskNode(
  props: NodeProps<TaskNodeType>,
) {
  const { entityId } = props.data;
  const { windows } = useSharedStores();
  const { backendUrl } = useBackend();
  const { task, status, disabledCache, executionId, showLogsButton } =
    useTaskRunStatus(entityId);

  const { data: artifacts } = useQuery({
    queryKey: ["artifacts", executionId],
    queryFn: () => getExecutionArtifacts(String(executionId), backendUrl),
    enabled: !!executionId,
  });

  const handleOpenLogs = () => {
    if (!task || !executionId) return;
    windows.openWindow(<Logs executionId={executionId} status={status} />, {
      id: `task-logs-${task.name}`,
      title: `Logs: ${task.name}`,
      size: { width: 500, height: 400 },
    });
  };

  const renderOutputAction = (output: TaskNodeOutput) => (
    <RunViewOutputPreview
      artifact={artifacts?.output_artifacts?.[output.name]}
      name={output.name}
      type={output.type}
    />
  );

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
          {...tracking("v2.run_view.canvas.task_node_open_logs")}
        >
          <Icon name="ScrollText" size="xs" />
          Open Logs
        </Button>
      )}

      <OutputActionsProvider value={renderOutputAction}>
        <TaskNode {...props} />
      </OutputActionsProvider>
    </div>
  );
});
