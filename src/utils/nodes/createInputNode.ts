import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";

import {
  extractPositionFromAnnotations,
  extractZIndexFromAnnotations,
} from "../annotations";
import type { InputSpec } from "../componentSpec";
import { inputNameToNodeId } from "./nodeIdUtils";

export const createInputNode = (
  input: InputSpec,
  nodeData: TaskNodeData,
  readOnly: boolean = false,
) => {
  const nodeType = "input";

  const { name, annotations, ...rest } = input;

  const position = extractPositionFromAnnotations(annotations);
  const zIndex = extractZIndexFromAnnotations(input.annotations, nodeType);

  const nodeId = inputNameToNodeId(name);

  return {
    id: nodeId,
    data: {
      ...rest,
      ...nodeData,
      label: name,
      readOnly,
    },
    position: position,
    type: nodeType,
    zIndex,
  } as Node;
};
