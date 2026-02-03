import { type Node } from "@xyflow/react";

import { type FlexNodeData } from "./types";

export const DEFAULT_STICKY_NOTE = {
  title: "Sticky Note",
  content: "",
  color: "#FFF9C4",
  zIndex: 1,
};

export const DEFAULT_FLEX_NODE_SIZE = { width: 150, height: 100 };

export const createFlexNode = (flexNode: FlexNodeData, readOnly: boolean) => {
  const { id, position, size } = flexNode;

  return {
    id,
    data: { ...flexNode, readOnly },
    ...size,
    position,
    type: "flex",
    connectable: false,
  } as Node;
};
