import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";

import type { TaskSpec } from "../componentSpec";
import { extractPositionFromAnnotations } from "./extractPositionFromAnnotations";
import { generateDynamicNodeCallbacks } from "./generateDynamicNodeCallbacks";
import { taskIdToNodeId } from "./nodeIdUtils";

export const createTaskNode = (
  task: [`${string}`, TaskSpec],
  nodeData: TaskNodeData,
  readOnly: boolean,
) => {
  const [taskId, taskSpec] = task;

  const position = extractPositionFromAnnotations(taskSpec.annotations);
  const nodeId = taskIdToNodeId(taskId);

  // Inject the taskId and nodeId into the callbacks
  const nodeCallbacks = nodeData.nodeCallbacks;
  const dynamicCallbacks = generateDynamicNodeCallbacks(nodeId, nodeCallbacks);

  return {
    id: nodeId,
    data: {
      ...nodeData,
      taskSpec,
      taskId,
      highlighted: false,
      callbacks: dynamicCallbacks, // Use these callbacks internally within the node
      readOnly,
    },
    position: position,
    type: "task",
  } as Node;
};
