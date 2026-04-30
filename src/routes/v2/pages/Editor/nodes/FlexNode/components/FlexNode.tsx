import { type Node, type NodeProps } from "@xyflow/react";
import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import { type MouseEvent } from "react";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  updateFlexNode,
  updateFlexNodeProperties,
} from "@/routes/v2/pages/Editor/nodes/FlexNode/flexNode.actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { FlexNodeCard } from "./FlexNodeCard";
import { FlexNodeSimplified } from "./FlexNodeSimplified";

type FlexNodeProps = NodeProps<Node<FlexNodeData, "flex">>;

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
  onNodeClick: (e: MouseEvent) => void;
  onUpdateProperties: (
    propertyUpdates: Partial<FlexNodeData["properties"]>,
  ) => void;
  onUpdateNode: (updates: Partial<FlexNodeData>) => void;
  onToggleLock: () => void;
}

export const EditorV2FlexNode = observer(function EditorV2FlexNode({
  data,
  id,
  selected,
}: FlexNodeProps) {
  const { editor } = useSharedStores();
  const { undo } = useEditorSession();
  const spec = useSpec();
  const showContent = useIsDetailedView();

  const { properties, readOnly, locked = false } = data;
  const {
    title,
    content,
    color,
    borderColor,
    titleFontSize = 12,
    contentFontSize = 10,
  } = properties;

  const handleUpdateNode = (updates: Partial<FlexNodeData>) => {
    if (!spec) return;
    updateFlexNode(undo, spec, id, updates);
  };

  const handleUpdateProperties = (
    propertyUpdates: Partial<FlexNodeData["properties"]>,
  ) => {
    if (!spec) return;
    updateFlexNodeProperties(undo, spec, id, propertyUpdates);
  };

  const handleToggleLock = () => {
    handleUpdateNode({ locked: !locked });
  };

  const handleClick = (e: MouseEvent) => {
    editor.selectNode(id, "flex", { shiftKey: e.shiftKey, entityId: id });
    if (locked) {
      e.stopPropagation();
    }
  };

  const isTransparent = color === "transparent";
  const isBorderTransparent = borderColor === "transparent";
  const hasContent = !!title || !!content;

  const viewProps: FlexNodeViewProps = {
    id,
    title,
    content,
    color,
    borderColor,
    titleFontSize,
    contentFontSize,
    locked,
    readOnly: !!readOnly,
    selected: !!selected,
    isTransparent,
    isBorderTransparent,
    hasContent,
    onNodeClick: handleClick,
    onUpdateProperties: handleUpdateProperties,
    onUpdateNode: handleUpdateNode,
    onToggleLock: handleToggleLock,
  };

  if (!showContent) {
    return <FlexNodeSimplified {...viewProps} />;
  }

  return <FlexNodeCard {...viewProps} />;
});
