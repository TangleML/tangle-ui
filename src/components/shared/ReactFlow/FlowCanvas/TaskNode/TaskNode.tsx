import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { useEdgeSelectionHighlight } from "@/hooks/useEdgeSelectionHighlight";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import { useFetchContainerExecutionState } from "@/services/executionService";
import type { TaskNodeData } from "@/types/taskNode";
import { isCacheDisabled, isCachedExecution } from "@/utils/cache";

import { StatusIndicator } from "./StatusIndicator";
import { TaskNodeCard } from "./TaskNodeCard";

const TaskNodeSkeleton = () => (
  <div className="w-60 h-30 rounded-lg border border-border bg-background">
    <Skeleton className="w-full h-full" />
  </div>
);

const TaskNodeInternal = ({ data, selected, id }: NodeProps) => {
  const executionData = useExecutionDataOptional();
  const { backendUrl } = useBackend();

  const typedData = useMemo(() => data as TaskNodeData, [data]);

  const status = useMemo(() => {
    const taskId = typedData.taskId ?? "";
    return executionData?.taskExecutionStatusMap.get(taskId);
  }, [executionData?.taskExecutionStatusMap, typedData.taskId]);

  const executionId = useMemo(() => {
    const taskId = typedData.taskId ?? "";
    return executionData?.details?.child_task_execution_ids?.[taskId];
  }, [executionData?.details?.child_task_execution_ids, typedData.taskId]);

  const { data: containerState } = useFetchContainerExecutionState(
    executionId,
    backendUrl,
  );

  const disabledCache = isCacheDisabled(typedData.taskSpec);

  const cached = useMemo(
    () =>
      isCachedExecution(
        containerState?.started_at,
        executionData?.metadata?.created_at,
      ),
    [containerState?.started_at, executionData?.metadata?.created_at],
  );

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
            cached={cached}
          />
        )}
        <TaskNodeCard />
      </div>
    </TaskNodeProvider>
  );
};

const TaskNode = withSuspenseWrapper(TaskNodeInternal, TaskNodeSkeleton);

export default memo(TaskNode);
