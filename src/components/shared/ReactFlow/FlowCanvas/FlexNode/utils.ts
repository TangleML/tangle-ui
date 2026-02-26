import { type Node } from "@xyflow/react";

import type { FlexNodeData } from "./types";

export const DEFAULT_STICKY_NOTE = {
  title: "Sticky Note",
  content: "",
  color: "#FFF9C4",
};

export const DEFAULT_FLEX_NODE_SIZE = { width: 150, height: 100 };
export const DEFAULT_BORDER_COLOR = "#BCBCBC";

export const createFlexNode = (
  flexNode: FlexNodeData,
  readOnly: boolean = false,
) => {
  const { id, position, size, zIndex, locked } = flexNode;

  return {
    id,
    data: { ...flexNode, readOnly },
    ...size,
    position,
    type: "flex",
    connectable: false,
    zIndex,
    selectable: !locked,
    draggable: !locked,
    className: locked ? "pointer-events-auto!" : undefined,
  } as Node;
};
