import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";

import { extractPositionFromAnnotations } from "../annotations";
import type { InputSpec } from "../componentSpec";
import { inputNameToNodeId } from "./nodeIdUtils";

export const createInputNode = (
  input: InputSpec,
  nodeData: TaskNodeData,
  readOnly: boolean = false,
) => {
  const { name, annotations, ...rest } = input;

  const position = extractPositionFromAnnotations(annotations);
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
    type: "input",
  } as Node;
};
