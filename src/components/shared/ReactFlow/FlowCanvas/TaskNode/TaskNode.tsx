import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";
import { isCacheDisabled } from "@/utils/cache";
import { deriveExecutionStatusFromStats } from "@/utils/executionStatus";

import { StatusIndicator } from "./StatusIndicator";
import { TaskNodeCard } from "./TaskNodeCard";

const TaskNode = ({ data, selected }: NodeProps) => {
  const executionData = useExecutionDataOptional();

  const typedData = useMemo(() => data as TaskNodeData, [data]);

  const status: ContainerExecutionStatus | undefined = useMemo(() => {
    const taskId = typedData.taskId ?? "";
    const executionId =
      executionData?.details?.child_task_execution_ids?.[taskId];
    if (!executionId) return undefined;

    const statusStats =
      executionData?.state?.child_execution_status_stats?.[executionId];

    return deriveExecutionStatusFromStats(statusStats);
  }, [
    executionData?.details?.child_task_execution_ids,
    executionData?.state?.child_execution_status_stats,
    typedData.taskId,
  ]);

  const disabledCache = isCacheDisabled(typedData.taskSpec);

  return (
    <TaskNodeProvider data={typedData} selected={selected} status={status}>
      {!!status && (
        <StatusIndicator status={status} disabledCache={disabledCache} />
      )}
      <TaskNodeCard />
    </TaskNodeProvider>
  );
};

export default memo(TaskNode);
