import {
  type Node,
  type NodeProps,
  NodeResizer,
  type ResizeDragEvent,
  type ResizeParams,
} from "@xyflow/react";
import { type MouseEvent, useState } from "react";

import { InlineTextEditor } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/InlineTextEditor";
import LockToggle from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/LockToggle";
import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import {
  updateFlexNode,
  updateFlexNodeProperties,
} from "@/routes/v2/pages/Editor/nodes/FlexNode/flexNode.actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const MIN_SIZE = { width: 50, height: 50 };

export const EditorV2FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { editor } = useSharedStores();
  const { undo } = useEditorSession();
  const spec = useSpec();

  const { properties, readOnly, locked = false } = data;
  const {
    title,
    content,
    color,
    borderColor,
    titleFontSize = 12,
    contentFontSize = 10,
  } = properties;

  const [isInlineEditingContent, setIsInlineEditingContent] = useState(false);
  const [isInlineEditingTitle, setIsInlineEditingTitle] = useState(false);

  const updateCurrentFlexNode = (updates: Partial<FlexNodeData>) => {
    if (!spec) return;
    updateFlexNode(undo, spec, id, updates);
  };

  const updateProperties = (
    propertyUpdates: Partial<FlexNodeData["properties"]>,
  ) => {
    if (!spec) return;
    updateFlexNodeProperties(undo, spec, id, propertyUpdates);
  };

  const toggleLock = () => {
    updateCurrentFlexNode({ locked: !locked });
  };

  const handleClick = (e: MouseEvent) => {
    editor.selectNode(id, "flex", { shiftKey: e.shiftKey, entityId: id });
    if (locked) {
      e.stopPropagation();
    }
  };

  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (locked || readOnly) return;

    setIsInlineEditingTitle(false);
    setIsInlineEditingContent(true);
  };

  const handleDoubleClickTitle = (e: MouseEvent<HTMLParagraphElement>) => {
    e.stopPropagation();
    if (locked) {
      toggleLock();
      return;
    }
    if (!readOnly) {
      setIsInlineEditingContent(false);
      setIsInlineEditingTitle(true);
    }
  };

  const handleResizeEnd = (_: ResizeDragEvent, params: ResizeParams) => {
    const width = Math.max(params.width, MIN_SIZE.width);
    const height = Math.max(params.height, MIN_SIZE.height);

    updateCurrentFlexNode({
      size: { width, height },
      position: { x: params.x, y: params.y },
    });
  };

  const handleSaveContent = (newContent: string) => {
    updateProperties({ content: newContent });
    setIsInlineEditingContent(false);
  };

  const handleSaveTitle = (newTitle: string) => {
    updateProperties({ title: newTitle });
    setIsInlineEditingTitle(false);
  };

  const switchEditor = () => {
    setIsInlineEditingTitle((prev) => !prev);
    setIsInlineEditingContent((prev) => !prev);
  };

  const isTransparent = color === "transparent";
  const isBorderTransparent = borderColor === "transparent";

  return (
    <>
      {!readOnly && (
        <NodeResizer
          color="var(--edge-selected)"
          isVisible={selected}
          minWidth={50}
          minHeight={50}
          onResizeEnd={handleResizeEnd}
        />
      )}
      <div
        key={id}
        className={cn(
          "p-1 rounded-lg h-full w-full group",
          readOnly && selected && "ring-2 ring-ring",
          isTransparent && "border-2 border-solid",
          isTransparent &&
            !title &&
            !content &&
            isBorderTransparent &&
            "border-2 border-dashed border-warning!",
          locked && "cursor-grab",
        )}
        style={{
          backgroundColor: color,
          borderColor: isTransparent ? borderColor : undefined,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className={cn(
            "rounded-sm p-1 h-full w-full overflow-hidden",
            isTransparent ? "bg-transparent" : "bg-white/40",
          )}
        >
          <BlockStack gap="1" className="w-full">
            <LockToggle
              size="xs"
              locked={locked}
              onToggleLock={toggleLock}
              showOnlyOnHover
              className="absolute top-1 right-1"
            />

            {title &&
              (isInlineEditingTitle ? (
                <InlineTextEditor
                  value={title}
                  placeholder="Enter title..."
                  textSize={titleFontSize}
                  onSave={handleSaveTitle}
                  onCancel={() => setIsInlineEditingTitle(false)}
                  onTab={switchEditor}
                  className="font-bold"
                />
              ) : (
                <p
                  style={{ fontSize: titleFontSize }}
                  className="font-bold whitespace-pre-wrap w-full"
                  onDoubleClick={handleDoubleClickTitle}
                >
                  {title}
                </p>
              ))}

            {isInlineEditingContent ? (
              <InlineTextEditor
                value={content}
                placeholder="Enter text..."
                textSize={contentFontSize}
                onSave={handleSaveContent}
                onCancel={() => setIsInlineEditingContent(false)}
                onTab={switchEditor}
              />
            ) : (
              <p
                style={{ fontSize: contentFontSize }}
                className="whitespace-pre-wrap"
              >
                {content}
              </p>
            )}
          </BlockStack>
        </div>
      </div>
    </>
  );
};
