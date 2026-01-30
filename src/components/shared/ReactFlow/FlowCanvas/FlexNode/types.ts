import type { XYPosition } from "@xyflow/react";

export interface FlexNodeData extends Record<string, unknown> {
  id: string;
  properties: FlexNodeProperties;
  size: { width: number; height: number };
  position: XYPosition;
  readOnly?: boolean;
}

type FlexNodeProperties = {
  title: string;
  content: string;
  color: string;
  zIndex: number;
};

export function isFlexNodeData(obj: any): obj is FlexNodeData {
  return (
    obj &&
    typeof obj === "object" &&
    "properties" in obj &&
    "size" in obj &&
    "position" in obj
  );
}
