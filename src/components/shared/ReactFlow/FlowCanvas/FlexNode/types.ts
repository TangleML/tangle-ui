import type { XYPosition } from "@xyflow/react";

type FlexNodeType = "sticky-note";

export interface FlexNodeData extends Record<string, unknown> {
  type: FlexNodeType;
  properties: StickyNoteProperties;
  size: { width: number; height: number };
  position: XYPosition;
  readOnly?: boolean;
}

type StickyNoteProperties = {
  title: string;
  content: string;
  color: string;
  zIndex: number;
};
