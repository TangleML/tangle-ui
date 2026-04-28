import {
  NodeResizer,
  type ResizeDragEvent,
  type ResizeParams,
} from "@xyflow/react";
import { type MouseEvent, useState } from "react";

import { InlineTextEditor } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/InlineTextEditor";
import LockToggle from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/LockToggle";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import { flexNodeVariants, type FlexNodeViewProps } from "./FlexNode";

const MIN_SIZE = { width: 50, height: 50 };

function FlexNodeTitle({
  title,
  fontSize,
  editing,
  locked,
  onSave,
  onCancel,
  onTab,
  onDoubleClick,
}: {
  title: string;
  fontSize: number;
  editing: boolean;
  locked: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onTab: () => void;
  onDoubleClick: (e: MouseEvent<HTMLParagraphElement>) => void;
}) {
  if (!title) return null;

  if (editing) {
    return (
      <InlineTextEditor
        value={title}
        placeholder="Enter title..."
        textSize={fontSize}
        onSave={onSave}
        onCancel={onCancel}
        onTab={onTab}
        className="font-bold"
      />
    );
  }

  // Raw <p> required: user-configurable fontSize needs inline style which Text doesn't accept
  return (
    <p
      style={{ fontSize }}
      className="font-bold whitespace-pre-wrap w-full"
      onDoubleClick={locked ? undefined : onDoubleClick}
    >
      {title}
    </p>
  );
}

function FlexNodeContent({
  content,
  fontSize,
  editing,
  onSave,
  onCancel,
  onTab,
}: {
  content: string;
  fontSize: number;
  editing: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onTab: () => void;
}) {
  if (editing) {
    return (
      <InlineTextEditor
        value={content}
        placeholder="Enter text..."
        textSize={fontSize}
        onSave={onSave}
        onCancel={onCancel}
        onTab={onTab}
      />
    );
  }

  // Raw <p> required: user-configurable fontSize needs inline style which Text doesn't accept
  return (
    <p style={{ fontSize }} className="whitespace-pre-wrap">
      {content}
    </p>
  );
}

export function FlexNodeCard({
  id,
  title,
  content,
  color,
  borderColor,
  titleFontSize,
  contentFontSize,
  locked,
  readOnly,
  selected,
  isTransparent,
  isBorderTransparent,
  hasContent,
  onNodeClick,
  onUpdateProperties,
  onUpdateNode,
  onToggleLock,
}: FlexNodeViewProps) {
  const [isInlineEditingContent, setIsInlineEditingContent] = useState(false);
  const [isInlineEditingTitle, setIsInlineEditingTitle] = useState(false);

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
      onToggleLock();
      return;
    }
    if (!readOnly) {
      setIsInlineEditingContent(false);
      setIsInlineEditingTitle(true);
    }
  };

  const handleResizeEnd = (_: ResizeDragEvent, params: ResizeParams) => {
    onUpdateNode({
      size: {
        width: Math.max(params.width, MIN_SIZE.width),
        height: Math.max(params.height, MIN_SIZE.height),
      },
      position: { x: params.x, y: params.y },
    });
  };

  const switchEditor = () => {
    setIsInlineEditingTitle((prev) => !prev);
    setIsInlineEditingContent((prev) => !prev);
  };

  return (
    <>
      {!readOnly && (
        <NodeResizer
          color="var(--edge-selected)"
          isVisible={selected}
          minWidth={MIN_SIZE.width}
          minHeight={MIN_SIZE.height}
          onResizeEnd={handleResizeEnd}
        />
      )}
      <div
        key={id}
        className={flexNodeVariants({
          readOnlySelected: !!(readOnly && selected),
          locked,
          transparent: isTransparent,
          hasContent,
          borderTransparent: isBorderTransparent,
        })}
        style={{
          backgroundColor: color,
          borderColor: isTransparent ? borderColor : undefined,
        }}
        onClick={onNodeClick}
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
              onToggleLock={onToggleLock}
              showOnlyOnHover
              className="absolute top-1 right-1"
            />

            <FlexNodeTitle
              title={title}
              fontSize={titleFontSize}
              editing={isInlineEditingTitle}
              locked={locked}
              onSave={(newTitle) => {
                onUpdateProperties({ title: newTitle });
                setIsInlineEditingTitle(false);
              }}
              onCancel={() => setIsInlineEditingTitle(false)}
              onTab={switchEditor}
              onDoubleClick={handleDoubleClickTitle}
            />

            <FlexNodeContent
              content={content}
              fontSize={contentFontSize}
              editing={isInlineEditingContent}
              onSave={(newContent) => {
                onUpdateProperties({ content: newContent });
                setIsInlineEditingContent(false);
              }}
              onCancel={() => setIsInlineEditingContent(false)}
              onTab={switchEditor}
            />
          </BlockStack>
        </div>
      </div>
    </>
  );
}
