import { type Node } from "@xyflow/react";

import { truncate } from "@/utils/string";

import type { FlexNodeData } from "./types";

export const DEFAULT_STICKY_NOTE = {
  title: "Sticky Note",
  content: "",
  color: "#FFF9C4",
};

export const DEFAULT_FLEX_NODE_SIZE = { width: 150, height: 100 };
export const DEFAULT_BORDER_COLOR = "#BCBCBC";

/** Clones `position` onto the RF node and into `data` so React Flow state does not alias the spec (fixes stale layout after undo in controlled flows). */
export const createFlexNode = (
  flexNode: FlexNodeData,
  readOnly: boolean = false,
) => {
  const { id, position, size, zIndex, locked } = flexNode;
  const positionCopy = { x: position.x, y: position.y };

  return {
    id,
    data: { ...flexNode, readOnly, position: positionCopy },
    ...size,
    position: positionCopy,
    type: "flex",
    connectable: false,
    zIndex,
    selectable: !locked,
    draggable: !locked,
    className: locked ? "pointer-events-auto!" : undefined,
  } as Node;
};

export function getFlexNodeDisplayName(data: FlexNodeData): string {
  if (data.properties.title) {
    return data.properties.title;
  }
  if (data.properties.content) {
    return truncate(data.properties.content, 12, { breakWords: false });
  }
  return "untitled";
}
