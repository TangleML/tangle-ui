import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";
import { isCacheDisabled } from "@/utils/cache";

import { StatusIndicator } from "./StatusIndicator";
import { TaskNodeCard } from "./TaskNodeCard";

const TaskNode = ({ data, selected }: NodeProps) => {
  const { taskStatusMap } = useComponentSpec();

  const typedData = useMemo(() => data as TaskNodeData, [data]);

  const status = taskStatusMap.get(
    typedData.taskId ?? "",
  ) as ContainerExecutionStatus;

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
