import type { XYPosition } from "@xyflow/react";

type FlexNodeType = "sticky-note";

export interface FlexNodeData extends Record<string, unknown> {
  type: FlexNodeType;
  properties: StickyNoteProperties;
  size: { width: number; height: number };
  position: XYPosition;
  readOnly?: boolean;
}

export type FlexNodeSpec = {
  type: FlexNodeType;
  properties: StickyNoteProperties;
  size: string;
  position: string;
};

type StickyNoteProperties = {
  title: string;
  content: string;
  color: string;
  zIndex: number;
};

export function parseFlexNodeSpec(spec: FlexNodeSpec): FlexNodeData {
  return {
    type: spec.type,
    properties: spec.properties,
    size: JSON.parse(spec.size),
    position: JSON.parse(spec.position),
  };
}
