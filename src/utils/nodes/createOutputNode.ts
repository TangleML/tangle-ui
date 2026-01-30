import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";

import { extractPositionFromAnnotations } from "../annotations";
import type { OutputSpec } from "../componentSpec";
import { outputNameToNodeId } from "./nodeIdUtils";

export const createOutputNode = (
  output: OutputSpec,
  nodeData: TaskNodeData,
  readOnly: boolean = false,
) => {
  const { name, annotations, ...rest } = output;

  const position = extractPositionFromAnnotations(annotations);
  const nodeId = outputNameToNodeId(name);

  return {
    id: nodeId,
    data: {
      ...rest,
      ...nodeData,
      label: name,
      readOnly,
    },
    position: position,
    type: "output",
  } as Node;
};
