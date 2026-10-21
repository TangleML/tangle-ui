import { type Node, type NodeProps } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { type MouseEvent } from "react";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  updateFlexNode,
  updateFlexNodeProperties,
} from "@/routes/v2/pages/Editor/nodes/FlexNode/flexNode.actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { FlexNodeCard } from "@/routes/v2/shared/nodes/FlexNode/FlexNodeCard";
import { FlexNodeSimplified } from "@/routes/v2/shared/nodes/FlexNode/FlexNodeSimplified";
import type { FlexNodeViewProps } from "@/routes/v2/shared/nodes/FlexNode/flexNodeView";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { isEditorVisualNodeSelected } from "@/routes/v2/shared/store/isEditorVisualNodeSelected";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

type FlexNodeProps = NodeProps<Node<FlexNodeData, "flex">>;

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

  const isSelected = isEditorVisualNodeSelected(editor, id, !!selected);

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
    selected: isSelected,
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
