import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import { useEdgeSelectionHighlight } from "@/hooks/useEdgeSelectionHighlight";
import { cn } from "@/lib/utils";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";
import { isCacheDisabled } from "@/utils/cache";

import { StatusIndicator } from "./StatusIndicator";
import { TaskNodeCard } from "./TaskNodeCard";

const TaskNode = ({ data, selected, id }: NodeProps) => {
  const executionData = useExecutionDataOptional();

  const typedData = useMemo(() => data as TaskNodeData, [data]);

  const status = useMemo(() => {
    const taskId = typedData.taskId ?? "";
    return executionData?.taskExecutionStatusMap.get(taskId);
  }, [executionData?.taskExecutionStatusMap, typedData.taskId]);

  const disabledCache = isCacheDisabled(typedData.taskSpec);

  const { isConnectedToSelectedEdge, hasAnySelectedEdge } =
    useEdgeSelectionHighlight(id);

  return (
    <TaskNodeProvider data={typedData} selected={selected} status={status}>
      <div
        className={cn(
          "transition-opacity duration-200",
          hasAnySelectedEdge && !isConnectedToSelectedEdge && "opacity-40",
        )}
      >
        {!!status && (
          <StatusIndicator status={status} disabledCache={disabledCache} />
        )}
        <TaskNodeCard />
      </div>
    </TaskNodeProvider>
  );
};

export default memo(TaskNode);
