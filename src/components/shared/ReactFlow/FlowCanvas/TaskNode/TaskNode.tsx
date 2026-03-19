import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { useEdgeSelectionHighlight } from "@/hooks/useEdgeSelectionHighlight";
import { cn } from "@/lib/utils";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";
import { isCacheDisabled } from "@/utils/cache";

import { StatusIndicator } from "./StatusIndicator";
import { TaskNodeCard } from "./TaskNodeCard";

const TaskNodeSkeleton = () => (
  <div className="w-60 h-30 rounded-lg border border-border bg-background">
    <Skeleton className="w-full h-full" />
  </div>
);

const TaskNodeInternal = ({ data, selected, id }: NodeProps) => {
  const executionData = useExecutionDataOptional();

  const typedData = useMemo(() => data as TaskNodeData, [data]);

  const taskId = typedData.taskId ?? "";

  const status = useMemo(() => {
    return executionData?.taskExecutionStatusMap.get(taskId);
  }, [executionData?.taskExecutionStatusMap, taskId]);

  const isCached = useMemo(() => {
    return executionData?.cachedTaskIds.has(taskId) ?? false;
  }, [executionData?.cachedTaskIds, taskId]);

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
          <StatusIndicator
            status={status}
            disabledCache={disabledCache}
            isCached={isCached}
          />
        )}
        <TaskNodeCard />
      </div>
    </TaskNodeProvider>
  );
};

const TaskNode = withSuspenseWrapper(TaskNodeInternal, TaskNodeSkeleton);

export default memo(TaskNode);
