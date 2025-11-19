import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";
import { buildNodeAnchor } from "@/utils/nodeAnchors";

import type { OutputSpec } from "../componentSpec";
import { extractPositionFromAnnotations } from "./extractPositionFromAnnotations";
import { outputNameToNodeId } from "./nodeIdUtils";

export const createOutputNode = (
  output: OutputSpec,
  nodeData: TaskNodeData,
) => {
  const { name, annotations, ...rest } = output;

  const position = extractPositionFromAnnotations(annotations);
  const nodeId = outputNameToNodeId(name);

  const pathPrefix = nodeData.nodePathPrefix ?? [];
  const nodeAnchor = buildNodeAnchor([...pathPrefix, "outputs", name]);

  return {
    id: nodeId,
    data: {
      ...rest,
      ...nodeData,
      label: name,
      nodeAnchor,
    },
    position: position,
    type: "output",
  } as Node;
};
