import type { XYPosition } from "@xyflow/react";

export interface FlexNodeData extends Record<string, unknown> {
  id: string;
  properties: FlexNodeProperties;
  metadata: FlexNodeMetadata;
  size: { width: number; height: number };
  position: XYPosition;
  zIndex: number;
  readOnly?: boolean;
  locked?: boolean;
}

type FlexNodeProperties = {
  title: string;
  content: string;
  color: string;
  borderColor?: string;
};

type FlexNodeMetadata = {
  createdAt: string;
  createdBy: string;
};

export function isFlexNodeData(obj: any): obj is FlexNodeData {
  return (
    obj &&
    typeof obj === "object" &&
    "id" in obj &&
    "properties" in obj &&
    "metadata" in obj &&
    "size" in obj &&
    "position" in obj &&
    "zIndex" in obj
  );
}
