import { type Node } from "@xyflow/react";

import { type FlexNodeSpec, parseFlexNodeSpec } from "./types";

export const DEFAULT_STICKY_NOTE = {
  title: "Sticky Note",
  content: "",
  color: "#FFF9C4",
  border: "#F0F0F0",
  zIndex: 1,
};

export const DEFAULT_FLEX_NODE_SIZE = { width: 150, height: 100 };

export const createFlexNode = (
  flexNode: [string, FlexNodeSpec],
  readOnly: boolean,
) => {
  const [nodeId, flexSpec] = flexNode;

  const flexNodeData = parseFlexNodeSpec(flexSpec);

  const { position, size } = flexNodeData;

  return {
    id: nodeId,
    data: { ...flexNodeData, readOnly },
    ...size,
    position,
    type: "flex",
    connectable: false,
  } as Node;
};
