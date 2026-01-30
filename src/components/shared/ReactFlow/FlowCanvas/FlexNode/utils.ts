import { type Node } from "@xyflow/react";

import type { FlexNodeData } from "./types";

export const createFlexNode = (
  flexNode: FlexNodeData,
  readOnly: boolean = false,
) => {
  const { id, position, size, zIndex } = flexNode;

  return {
    id,
    data: { ...flexNode, readOnly },
    ...size,
    position,
    type: "flex",
    connectable: false,
    zIndex,
  } as Node;
};
