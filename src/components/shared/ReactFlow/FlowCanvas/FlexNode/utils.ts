import { type Node } from "@xyflow/react";

import type { FlexNodeData } from "./types";

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
