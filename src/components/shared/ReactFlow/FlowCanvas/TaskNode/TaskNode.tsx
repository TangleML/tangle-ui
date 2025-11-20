import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import { getRunStatus } from "@/services/executionService";
import type { TaskNodeData } from "@/types/taskNode";
import { isCacheDisabled } from "@/utils/cache";

import { StatusIndicator } from "./StatusIndicator";
import { TaskNodeCard } from "./TaskNodeCard";

const TaskNode = ({ id, data, selected }: NodeProps) => {
  const executionData = useExecutionDataOptional();

  const typedData = useMemo(() => data as TaskNodeData, [data]);

  const status = useMemo(() => {
    const taskId = typedData.taskId ?? "";
    const statusCounts = executionData?.taskStatusCountsMap.get(taskId);

    if (!statusCounts) {
      return undefined;
    }

    return getRunStatus(statusCounts);
  }, [executionData?.taskStatusCountsMap, typedData.taskId]);

  const disabledCache = isCacheDisabled(typedData.taskSpec);

  const anchor = typedData.nodeAnchor;
  return (
    <div
      data-node-anchor={anchor}
      id={anchor}
      data-node-id={id}
      className="rounded-[32px] transition-shadow duration-200"
    >
      <TaskNodeProvider data={typedData} selected={selected} status={status}>
        {!!status && (
          <StatusIndicator status={status} disabledCache={disabledCache} />
        )}
        <TaskNodeCard />
      </TaskNodeProvider>
    </div>
  );
};

export default memo(TaskNode);
