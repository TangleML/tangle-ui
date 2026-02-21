import {
  type Node,
  type NodeProps,
  NodeResizer,
  type ResizeDragEvent,
  type ResizeParams,
} from "@xyflow/react";
import { type MouseEvent, useEffect, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { useContextPanel } from "@/providers/ContextPanelProvider";

import { FlexNodeEditor } from "./FlexNodeEditor";
import { InlineTextEditor } from "./InlineTextEditor";
import LockToggle from "./LockToggle";
import type { FlexNodeData } from "./types";
import { useFlexNodeUpdate } from "./useFlexNodeUpdate";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const MIN_SIZE = { width: 50, height: 50 };

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { properties, readOnly, locked = false } = data;
  const {
    title,
    content,
    color,
    borderColor,
    titleFontSize = 12,
    contentFontSize = 10,
  } = properties;

  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [isContextPanelFocus, setIsContextPanelFocus] = useState(false);

  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

  const { updateFlexNode, updateProperties } = useFlexNodeUpdate(data);

  const toggleLock = () => {
    updateFlexNode({ locked: !locked });
  };

  const handleClick = (e: MouseEvent) => {
    if (locked) {
      e.stopPropagation();
      setIsContextPanelFocus(true);
      setContent(
        <FlexNodeEditor
          key={`${id}-${locked}`}
          flexNode={data}
          readOnly={readOnly}
          toggleLock={toggleLock}
        />,
      );
      setContextPanelOpen(true);
    }
  };

  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (locked) {
      return;
    }

    if (!readOnly) {
      setIsInlineEditing(true);
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

  useEffect(() => {
    if (selected) {
      setIsContextPanelFocus(true);
      setContent(
        <FlexNodeEditor
          key={`${id}-${locked}`}
          flexNode={data}
          readOnly={readOnly}
          toggleLock={toggleLock}
        />,
      );
      setContextPanelOpen(true);
    } else {
      setIsContextPanelFocus(false);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [selected]);

  useEffect(() => {
    if (isContextPanelFocus) {
      setContent(
        <FlexNodeEditor
          key={`${id}-${locked}`}
          flexNode={data}
          readOnly={readOnly}
          toggleLock={toggleLock}
        />,
      );
    }
  }, [data, locked, isContextPanelFocus, id, readOnly]);

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

            {title && (
              <p
                style={{ fontSize: titleFontSize }}
                className="font-bold whitespace-pre-wrap"
              >
                {title}
              </p>
            )}

            {isInlineEditing ? (
              <InlineTextEditor
                value={content}
                placeholder="Enter text..."
                textSize={contentFontSize}
                onSave={handleSaveContent}
                onCancel={() => setIsInlineEditing(false)}
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
