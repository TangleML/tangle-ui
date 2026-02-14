import { useRef, useState } from "react";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { Position, WindowAction, WindowConfig } from "./types";
import {
  bringToFront,
  closeWindow,
  getWindowContent,
  hideWindow,
  toggleMaximize,
  toggleMinimize,
  updateWindowPosition,
  updateWindowSize,
  windowStore,
} from "./windowStore";

interface WindowProps {
  windowId: string;
}

export function Window({ windowId }: WindowProps) {
  const snap = useSnapshot(windowStore);
  const windowConfig = snap.windows[windowId] as WindowConfig | undefined;
  const zIndex = snap.windowOrder.indexOf(windowId);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  if (!windowConfig || windowConfig.state === "hidden") {
    return null;
  }

  const { title, state, position, size, minSize, disabledActions } = windowConfig;
  // Get content from separate map (not stored in proxy to avoid React Compiler issues)
  const content = getWindowContent(windowId);
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";

  const isActionDisabled = (action: WindowAction) =>
    disabledActions?.includes(action) ?? false;

  const isAtFront = zIndex === snap.windowOrder.length - 1;

  const handleMouseDown = () => {
    // Only bring to front if not already at front to avoid unnecessary re-renders
    if (!isAtFront) {
      // Defer the store update to avoid re-rendering during focus transitions
      // This prevents Monaco editor crashes caused by re-renders while handling focus
      requestAnimationFrame(() => {
        bringToFront(windowId);
      });
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking on buttons
    if ((e.target as HTMLElement).closest("button")) return;

    if (!isAtFront) {
      // Defer to avoid re-rendering during focus transitions
      requestAnimationFrame(() => {
        bringToFront(windowId);
      });
    }
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateWindowPosition(windowId, {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(minSize.width, startWidth + (e.clientX - startX));
      const newHeight = Math.max(
        minSize.height,
        startHeight + (e.clientY - startY),
      );
      updateWindowSize(windowId, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Calculate content height (total height minus header ~44px)
  const contentHeight = size.height - 44;

  // Maximized state: full viewport
  const windowStyle = isMaximized
    ? {
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 50 + zIndex,
      }
    : {
        left: position.x,
        top: position.y,
        width: isMinimized ? "auto" : size.width,
        height: isMinimized ? "auto" : size.height,
        minWidth: minSize.width,
        minHeight: isMinimized ? "auto" : minSize.height,
        zIndex: 50 + zIndex,
      };

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed rounded-lg shadow-xl border border-gray-400 overflow-hidden",
        "bg-gray-100 text-gray-900 flex flex-col",
        (isDragging || isResizing) && "select-none",
        isDragging && "cursor-grabbing",
        isMaximized && "rounded-none",
      )}
      style={windowStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Draggable area */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 bg-gray-200",
          "cursor-grab border-b border-gray-300 shrink-0",
          isDragging && "cursor-grabbing",
          isMaximized && "cursor-default",
        )}
        onMouseDown={isMaximized ? undefined : handleHeaderMouseDown}
      >
        <InlineStack gap="2" blockAlign="center" className="min-w-0 flex-1">
          <Text size="sm" weight="semibold" className="text-gray-700 truncate">
            {title}
          </Text>
        </InlineStack>

        <InlineStack
          gap="1"
          blockAlign="center"
          className="shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Minimize button (collapse to header) */}
          {!isActionDisabled("minimize") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-gray-700 hover:bg-gray-300"
              onClick={() => toggleMinimize(windowId)}
              title={isMinimized ? "Expand" : "Minimize"}
            >
              <Icon name={isMinimized ? "ChevronDown" : "Minus"} size="sm" />
            </Button>
          )}

          {/* Maximize button */}
          {!isActionDisabled("maximize") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-gray-700 hover:bg-gray-300"
              onClick={() => toggleMaximize(windowId)}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              <Icon name={isMaximized ? "Minimize2" : "Maximize2"} size="sm" />
            </Button>
          )}

          {/* Hide button (to task panel) */}
          {!isActionDisabled("hide") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-gray-700 hover:bg-gray-300"
              onClick={() => hideWindow(windowId)}
              title="Hide to task panel"
            >
              <Icon name="PanelBottomClose" size="sm" />
            </Button>
          )}

          {/* Close button */}
          {!isActionDisabled("close") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-red-500 hover:bg-gray-300"
              onClick={() => closeWindow(windowId)}
              title="Close"
            >
              <Icon name="X" size="sm" />
            </Button>
          )}
        </InlineStack>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div
          className="flex-1 min-h-0 overflow-auto bg-gray-50"
          style={{ height: isMaximized ? "calc(100vh - 44px)" : contentHeight }}
        >
          {content}
        </div>
      )}

      {/* Resize handle - only shown when not minimized/maximized */}
      {!isMinimized && !isMaximized && (
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
            "hover:bg-gray-300 rounded-tl-sm transition-colors",
          )}
          onMouseDown={handleResizeMouseDown}
        >
          <svg
            className="w-full h-full text-gray-500"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
          </svg>
        </div>
      )}
    </div>
  );
}

