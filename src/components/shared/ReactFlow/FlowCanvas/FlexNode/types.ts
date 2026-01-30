import type { XYPosition } from "@xyflow/react";

export interface FlexNodeData extends Record<string, unknown> {
  id?: string;
  title?: string;
  content?: string;
  color?: string;
  border?: string;
  size: { width: number; height: number };
  position: XYPosition;
}
