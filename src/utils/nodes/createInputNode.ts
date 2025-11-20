import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";
import { buildNodeAnchor } from "@/utils/nodeAnchors";

import type { InputSpec } from "../componentSpec";
import { extractPositionFromAnnotations } from "./extractPositionFromAnnotations";
import { inputNameToNodeId } from "./nodeIdUtils";

export const createInputNode = (input: InputSpec, nodeData: TaskNodeData) => {
  const { name, annotations, ...rest } = input;

  const position = extractPositionFromAnnotations(annotations);
  const nodeId = inputNameToNodeId(name);
  const pathPrefix = nodeData.nodePathPrefix ?? [];
  const nodeAnchor = buildNodeAnchor([...pathPrefix, "inputs", name]);

  return {
    id: nodeId,
    data: {
      ...rest,
      ...nodeData,
      label: name,
      nodeAnchor,
    },
    position: position,
    type: "input",
  } as Node;
};
