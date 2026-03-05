import type { Node } from "@xyflow/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider, useTaskNode } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";

import TaskOverview from "../TaskNode/TaskOverview";

export const TaskDetailPanel = ({ node }: { node: Node }) => {
  const data = node.data as TaskNodeData;

  const executionData = useExecutionDataOptional();

  if (!data.taskId || !data.taskSpec) {
    return (
      <InfoBox title="Unable to Load Task Details" variant="error">
        <Paragraph size="sm" tone="subdued">
          Unable to load task details. Missing task ID or task specification.
        </Paragraph>
      </InfoBox>
    );
  }

  const status = executionData?.taskExecutionStatusMap.get(data.taskId);

  return (
    <TaskNodeProvider data={data} status={status} selected>
      <TaskDetailContent />
    </TaskNodeProvider>
  );
};

const TaskDetailContent = () => {
  const taskNode = useTaskNode();
  return <TaskOverview taskNode={taskNode} />;
};
