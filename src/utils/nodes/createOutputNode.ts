import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";

import type { OutputSpec } from "../componentSpec";
import { extractPositionFromAnnotations } from "./extractPositionFromAnnotations";
import { outputNameToNodeId } from "./nodeIdUtils";

export const createOutputNode = (
  output: OutputSpec,
  nodeData: TaskNodeData,
  readOnly: boolean,
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
