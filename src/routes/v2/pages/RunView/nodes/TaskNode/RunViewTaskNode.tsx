import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { StatusIndicator } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNode } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
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

  return (
    <div className="relative">
      {!!status && (
        <StatusIndicator status={status} disabledCache={disabledCache} />
      )}
      <TaskNode {...props} />
    </div>
  );
});
