import type { Node } from "@xyflow/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { TaskNodeProvider, useTaskNode } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";
import { isGraphImplementation } from "@/utils/componentSpec";
import { nodeIdToTaskId } from "@/utils/nodes/nodeIdUtils";

import TaskOverview from "../TaskNode/TaskOverview";

export const TaskDetailPanel = ({ node }: { node: Node }) => {
  const { currentSubgraphSpec } = useComponentSpec();
  const executionData = useExecutionDataOptional();

  if (!isGraphImplementation(currentSubgraphSpec.implementation)) {
    return (
      <InfoBox title="Unable to Load Task Details" variant="error">
        <Paragraph size="sm" tone="subdued">
          Unable to load task details. Graph specification is invalid.
        </Paragraph>
      </InfoBox>
    );
  }

  const taskId = nodeIdToTaskId(node.id);
  const taskSpec = currentSubgraphSpec.implementation.graph.tasks?.[taskId];

  if (!taskId || !taskSpec) {
    return (
      <InfoBox title="Unable to Load Task Details" variant="error">
        <Paragraph size="sm" tone="subdued">
          Unable to load task details. Missing task ID or task specification.
        </Paragraph>
      </InfoBox>
    );
  }

  const status = executionData?.taskExecutionStatusMap.get(taskId);
  const freshData: TaskNodeData = { ...node.data, taskSpec };

  return (
    <TaskNodeProvider data={freshData} status={status} selected>
      <TaskDetailContent />
    </TaskNodeProvider>
  );
};

const TaskDetailContent = () => {
  const taskNode = useTaskNode();
  return <TaskOverview taskNode={taskNode} />;
};
