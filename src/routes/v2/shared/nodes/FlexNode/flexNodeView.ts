import { cva } from "class-variance-authority";
import type { MouseEvent } from "react";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";

export const flexNodeVariants = cva("p-1 rounded-lg h-full w-full group", {
  variants: {
    readOnlySelected: { true: "ring-2 ring-ring", false: "" },
    locked: { true: "cursor-grab", false: "" },
    transparent: { true: "", false: "" },
    hasContent: { true: "", false: "" },
    borderTransparent: { true: "", false: "" },
  },
  compoundVariants: [
    {
      transparent: true,
      hasContent: true,
      className: "border-2 border-solid",
    },
    {
      transparent: true,
      hasContent: false,
      borderTransparent: false,
      className: "border-2 border-solid",
    },
    {
      transparent: true,
      hasContent: false,
      borderTransparent: true,
      className: "border-2 border-dashed border-warning!",
    },
  ],
  defaultVariants: {
    readOnlySelected: false,
    locked: false,
    transparent: false,
    hasContent: true,
    borderTransparent: false,
  },
});

export interface FlexNodeViewProps {
  id: string;
  title: string;
  content: string;
  color: string;
  borderColor?: string;
  titleFontSize: number;
  contentFontSize: number;
  locked: boolean;
  readOnly: boolean;
  selected: boolean;
  isTransparent: boolean;
  isBorderTransparent: boolean;
  hasContent: boolean;
  onNodeClick?: (e: MouseEvent) => void;
  onUpdateProperties?: (
    propertyUpdates: Partial<FlexNodeData["properties"]>,
  ) => void;
  onUpdateNode?: (updates: Partial<FlexNodeData>) => void;
  onToggleLock?: () => void;
}
