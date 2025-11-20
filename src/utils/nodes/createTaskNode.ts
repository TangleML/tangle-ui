import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";
import { buildNodeAnchor } from "@/utils/nodeAnchors";

import type { TaskSpec } from "../componentSpec";
import { extractPositionFromAnnotations } from "./extractPositionFromAnnotations";
import { generateDynamicNodeCallbacks } from "./generateDynamicNodeCallbacks";
import { taskIdToNodeId } from "./nodeIdUtils";

export const createTaskNode = (
  task: [`${string}`, TaskSpec],
  nodeData: TaskNodeData,
) => {
  const [taskId, taskSpec] = task;

  const position = extractPositionFromAnnotations(taskSpec.annotations);
  const nodeId = taskIdToNodeId(taskId);

  // Inject the taskId and nodeId into the callbacks
  const nodeCallbacks = nodeData.nodeCallbacks;
  const dynamicCallbacks = generateDynamicNodeCallbacks(nodeId, nodeCallbacks);

  const pathPrefix = nodeData.nodePathPrefix ?? [];
  const nodeAnchor = buildNodeAnchor([...pathPrefix, taskId]);

  return {
    id: nodeId,
    data: {
      ...nodeData,
      taskSpec,
      taskId,
      nodeAnchor,
      highlighted: false,
      callbacks: dynamicCallbacks, // Use these callbacks internally within the node
    },
    position: position,
    type: "task",
  } as Node;
};
