import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { SnapPreview } from "./SnapPreview";
import { detectSnapPreview, shouldDetach } from "./snapUtils";
import type {
  Position,
  SnapPreviewType,
  WindowAction,
  WindowConfig,
} from "./types";
import {
  attachWindow,
  bringToFront,
  closeWindow,
  detachWindow,
  dockWindow,
  getAllWindows,
  getWindowContent,
  hideWindow,
  isWindowDocked,
  toggleMaximize,
  toggleMinimize,
  undockWindow,
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
  const [snapPreview, setSnapPreview] = useState<SnapPreviewType | null>(null);

  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const dragStartPosition = useRef<Position>({ x: 0, y: 0 });
  const wasAttached = useRef(false);
  const hasDetached = useRef(false);
  const snapPreviewRef = useRef<SnapPreviewType | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!windowConfig || windowConfig.state === "hidden") {
    return null;
  }

  const {
    title,
    state,
    position,
    size,
    minSize,
    disabledActions,
    dockState,
    attachedTo,
  } = windowConfig;
  // Get content from separate map (not stored in proxy to avoid React Compiler issues)
  const content = getWindowContent(windowId);
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";
  const isDocked = dockState !== undefined && dockState !== "none";
  const isAttached = !!attachedTo;

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
    dragStartPosition.current = { ...position };
    wasAttached.current = isAttached;
    hasDetached.current = false;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      };

      // Check for detachment if window was attached
      if (wasAttached.current && !hasDetached.current) {
        if (shouldDetach(newPosition, dragStartPosition.current)) {
          detachWindow(windowId);
          hasDetached.current = true;
        } else {
          // Don't allow movement while still attached and not detached
          return;
        }
      }

      // Update window position
      updateWindowPosition(windowId, newPosition);

      // If window was docked, undock it when dragging
      if (isWindowDocked(windowId)) {
        undockWindow(windowId);
      }

      // Detect snap preview
      const allWindows = getAllWindows();
      const preview = detectSnapPreview(
        windowId,
        newPosition,
        size,
        allWindows,
        wasAttached.current && !hasDetached.current,
        dragStartPosition.current,
      );
      snapPreviewRef.current = preview;
      setSnapPreview(preview);
    };

    const handleMouseUp = () => {
      // Execute snap action if preview is active (use ref to get current value)
      const currentPreview = snapPreviewRef.current;
      console.log("[Window] handleMouseUp - snapPreview:", currentPreview);

      if (currentPreview) {
        if (currentPreview.type === "edge") {
          console.log("[Window] Docking to edge:", currentPreview.side);
          dockWindow(windowId, currentPreview.side);
        } else if (currentPreview.type === "attach") {
          console.log("[Window] Attaching to window:", currentPreview.parentId);
          attachWindow(windowId, currentPreview.parentId);
        }
      }

      setIsDragging(false);
      setSnapPreview(null);
      snapPreviewRef.current = null;
      wasAttached.current = false;
      hasDetached.current = false;
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
      const newWidth = Math.max(
        minSize.width,
        startWidth + (e.clientX - startX),
      );

      // If docked, only allow width resizing (height stays full viewport)
      if (isDocked) {
        updateWindowSize(windowId, { width: newWidth, height: size.height });
      } else {
        const newHeight = Math.max(
          minSize.height,
          startHeight + (e.clientY - startY),
        );
        updateWindowSize(windowId, { width: newWidth, height: newHeight });
      }
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
    <>
      <div
        ref={panelRef}
        className={cn(
          "fixed rounded-lg shadow-xl border overflow-hidden",
          "bg-gray-100 text-gray-900 flex flex-col",
          (isDragging || isResizing) && "select-none",
          isDragging && "cursor-grabbing",
          isMaximized && "rounded-none",
          // Visual indicator for docked windows
          isDocked ? "border-blue-400 border-2" : "border-gray-400",
          // Visual indicator for attached windows
          // isAttached && "border-green-400 border-2",
        )}
        style={windowStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Header - Draggable area */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2",
            "cursor-grab border-b shrink-0",
            isDragging && "cursor-grabbing",
            isMaximized && "cursor-default",
            isDocked ? "bg-blue-100 border-blue-200" : "bg-gray-200 border-gray-300",
            // isAttached && "bg-green-100 border-green-200",
          )}
          onMouseDown={isMaximized ? undefined : handleHeaderMouseDown}
        >
          <InlineStack gap="2" blockAlign="center" className="min-w-0 flex-1">
            {/* Dock indicator */}
            {isDocked && (
              <Icon
                name={dockState === "left" ? "PanelLeft" : "PanelRight"}
                size="xs"
                className="text-blue-600 shrink-0"
              />
            )}
            {/* Attach indicator */}
            {isAttached && (
              <Icon
                name="Link"
                size="xs"
                className="text-green-600 shrink-0"
              />
            )}
            <Text size="sm" weight="semibold" className="text-gray-700 truncate">
              {title}
            </Text>
          </InlineStack>

          <div
            className="shrink-0 flex items-center gap-1"
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
          </div>
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
        {/* For docked windows, only allow horizontal resize */}
        {!isMinimized && !isMaximized && (
          <div
            className={cn(
              "absolute bottom-0 right-0 w-4 h-4",
              isDocked ? "cursor-e-resize" : "cursor-se-resize",
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

      {/* Snap preview overlay - rendered in portal to ensure it's above all windows */}
      {isDragging &&
        snapPreview &&
        createPortal(
          <SnapPreview preview={snapPreview} windowWidth={size.width} />,
          document.body,
        )}
    </>
  );
}
