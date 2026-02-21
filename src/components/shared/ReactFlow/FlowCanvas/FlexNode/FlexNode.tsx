import {
  type Node,
  type NodeProps,
  NodeResizer,
  type ResizeDragEvent,
  type ResizeParams,
} from "@xyflow/react";
import { type MouseEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { useContextPanel } from "@/providers/ContextPanelProvider";

import { FlexNodeEditor } from "./FlexNodeEditor";
import { InlineTextEditor } from "./InlineTextEditor";
import type { FlexNodeData } from "./types";
import { useFlexNodeUpdate } from "./useFlexNodeUpdate";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const MIN_SIZE = { width: 50, height: 50 };

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { properties, readOnly, locked } = data;
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

  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

  const { updateFlexNode, updateProperties } = useFlexNodeUpdate(data);

  const toggleLock = () => {
    updateFlexNode({ locked: !locked });
  };

  const handleLockToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    toggleLock();
  };

  const handleDoubleClick = () => {
    if (locked) {
      toggleLock();
      return;
    }
    if (!readOnly) {
      setIsInlineEditingContent(true);
    }
  };

  const handleDoubleClickTitle = (e: MouseEvent<HTMLParagraphElement>) => {
    e.stopPropagation();
    if (locked) {
      toggleLock();
      return;
    }
    if (!readOnly) {
      setIsInlineEditingTitle(true);
    }
  };

  const handleResizeEnd = (_: ResizeDragEvent, params: ResizeParams) => {
    const width = Math.max(params.width, MIN_SIZE.width);
    const height = Math.max(params.height, MIN_SIZE.height);

    updateFlexNode({
      size: { width, height },
      position: { x: params.x, y: params.y },
    });
  };

  const handleSaveContent = (newContent: string) => {
    updateProperties({
      content: newContent,
    });
  };

  const handleSaveTitle = (newTitle: string) => {
    updateProperties({
      title: newTitle,
    });
  };

  useEffect(() => {
    if (selected) {
      setContent(<FlexNodeEditor flexNode={data} readOnly={readOnly} />);
      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [data, readOnly, selected]);

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
        )}
        style={{
          backgroundColor: color,
          borderColor: isTransparent ? borderColor : undefined,
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className={cn(
            "rounded-sm p-1 h-full w-full overflow-hidden",
            isTransparent ? "bg-transparent" : "bg-white/40",
          )}
        >
          <BlockStack gap="1" className="w-full">
            <Button
              variant="ghost"
              size="min"
              onClick={handleLockToggle}
              className={cn(
                "absolute top-1 right-1 opacity-50 hover:bg-transparent hover:opacity-100",
                !locked && "hidden group-hover:block",
              )}
            >
              <Icon name={locked ? "Lock" : "LockOpen"} className="w-2! h-2!" />
            </Button>

            {title &&
              (isInlineEditingTitle ? (
                <InlineTextEditor
                  value={title}
                  placeholder="Enter title..."
                  textSize={titleFontSize}
                  onSave={handleSaveTitle}
                  onCancel={() => setIsInlineEditingTitle(false)}
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

export default FlexNode;
