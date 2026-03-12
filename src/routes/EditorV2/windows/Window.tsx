import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { ContentWindowState } from "./ContentWindowStateContext";
import { ContentWindowStateProvider } from "./ContentWindowStateContext";
import { SnapPreview } from "./SnapPreview";
import { detectSnapPreview, shouldDetach } from "./snapUtils";
import {
  DEFAULT_DOCKED_HEIGHT,
  MIN_DOCKED_HEIGHT,
  type Position,
  type SnapPreviewType,
  TASK_PANEL_HEIGHT,
  type WindowAction,
  type WindowConfig,
} from "./types";
import {
  attachWindow,
  bringToFront,
  closeWindow,
  detachWindow,
  dockWindow,
  getAllWindows,
  getDockAreaWindowIds,
  getWindowContent,
  hideWindow,
  isWindowDocked,
  toggleMaximize,
  toggleMinimize,
  undockWindow,
  updateDockedWindowHeight,
  updateWindowPosition,
  updateWindowSize,
  windowStore,
} from "./windowStore";

interface WindowProps {
  windowId: string;
  docked?: boolean;
}

export function Window({ windowId, docked = false }: WindowProps) {
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
  const wasDocked = useRef(false);
  const hasUndocked = useRef(false);
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
    dockedHeight,
  } = windowConfig;

  const content = getWindowContent(windowId);
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";
  const isDocked = dockState !== undefined && dockState !== "none";
  const isAttached = !!attachedTo;
  const effectiveDockedHeight = dockedHeight ?? DEFAULT_DOCKED_HEIGHT;
  const dockAreaCollapsed = isDocked
    ? snap.dockAreas[dockState as "left" | "right"].collapsed
    : false;

  const contentWindowState: ContentWindowState = {
    windowId,
    state,
    isMaximized,
    isMinimized,
    isDocked,
    dockSide: dockState,
    dockAreaCollapsed,
    isAttached,
  };

  const hasHiddenWindows = snap.windowOrder.some(
    (id) => snap.windows[id]?.state === "hidden",
  );
  const taskPanelOffset = hasHiddenWindows ? TASK_PANEL_HEIGHT : 0;

  const isActionDisabled = (action: WindowAction) =>
    disabledActions?.includes(action) ?? false;

  const isAtFront = zIndex === snap.windowOrder.length - 1;

  const raiseZIndex = () => {
    if (!docked && !isAtFront && panelRef.current) {
      panelRef.current.style.zIndex = String(20 + snap.windowOrder.length);
    }
  };

  const handleMouseDown = () => {
    raiseZIndex();
  };

  const handleClick = () => {
    if (!isAtFront) {
      bringToFront(windowId);
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;

    raiseZIndex();

    setIsDragging(true);
    wasDocked.current = isDocked;
    hasUndocked.current = false;

    if (docked) {
      // For docked windows, use the mouse position relative to the panel element
      const rect = panelRef.current?.getBoundingClientRect();
      dragOffset.current = {
        x: rect ? e.clientX - rect.left : 0,
        y: rect ? e.clientY - rect.top : 0,
      };
      dragStartPosition.current = {
        x: rect?.left ?? e.clientX,
        y: rect?.top ?? e.clientY,
      };
    } else {
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      dragStartPosition.current = { ...position };
    }
    wasAttached.current = isAttached;
    hasDetached.current = false;

    const handleMouseMove = (moveE: MouseEvent) => {
      const newPosition = {
        x: moveE.clientX - dragOffset.current.x,
        y: moveE.clientY - dragOffset.current.y,
      };

      // Check for detachment if window was attached
      if (wasAttached.current && !hasDetached.current) {
        if (shouldDetach(newPosition, dragStartPosition.current)) {
          detachWindow(windowId);
          hasDetached.current = true;
        } else {
          return;
        }
      }

      // If window was docked, undock it when dragging far enough
      if (wasDocked.current && !hasUndocked.current) {
        const dx = Math.abs(
          moveE.clientX - (dragStartPosition.current.x + dragOffset.current.x),
        );
        const dy = Math.abs(
          moveE.clientY - (dragStartPosition.current.y + dragOffset.current.y),
        );
        if (dx > 20 || dy > 20) {
          undockWindow(windowId);
          hasUndocked.current = true;
          // Place the floating window centered under the cursor
          const win = windowStore.windows[windowId];
          if (win) {
            const halfWidth = win.size.width / 2;
            const headerGrab = 20;
            win.position.x = moveE.clientX - halfWidth;
            win.position.y = moveE.clientY - headerGrab;
            dragOffset.current = { x: halfWidth, y: headerGrab };
          }
        } else {
          return;
        }
      }

      updateWindowPosition(windowId, newPosition);

      // If window was docked (legacy overlay dock), undock it when dragging
      if (!wasDocked.current && isWindowDocked(windowId)) {
        undockWindow(windowId);
      }

      const allWindows = getAllWindows();
      const mousePos = { x: moveE.clientX, y: moveE.clientY };
      const dockAreaIds = {
        left: [...getDockAreaWindowIds("left")],
        right: [...getDockAreaWindowIds("right")],
      };
      const preview = detectSnapPreview(
        windowId,
        newPosition,
        size,
        allWindows,
        wasAttached.current && !hasDetached.current,
        dragStartPosition.current,
        mousePos,
        dockAreaIds,
      );
      snapPreviewRef.current = preview;
      setSnapPreview(preview);
    };

    const handleMouseUp = () => {
      const currentPreview = snapPreviewRef.current;

      if (currentPreview) {
        if (currentPreview.type === "edge") {
          dockWindow(windowId, currentPreview.side);
        } else if (currentPreview.type === "attach") {
          attachWindow(windowId, currentPreview.parentId);
        } else if (currentPreview.type === "dock-insert") {
          dockWindow(windowId, currentPreview.side, currentPreview.insertIndex);
        }
      }

      if (!isAtFront) {
        bringToFront(windowId);
      }
      setIsDragging(false);
      setSnapPreview(null);
      snapPreviewRef.current = null;
      wasAttached.current = false;
      hasDetached.current = false;
      wasDocked.current = false;
      hasUndocked.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // --- Docked mode rendering ---
  if (docked) {
    const handleDockedResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = effectiveDockedHeight;

      const onMouseMove = (moveE: MouseEvent) => {
        const newHeight = Math.max(
          MIN_DOCKED_HEIGHT,
          startHeight + (moveE.clientY - startY),
        );
        updateDockedWindowHeight(windowId, newHeight);
      };

      const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const headerHeight = 26;

    // Maximized docked window: render as full-viewport overlay via portal
    if (isMaximized) {
      return createPortal(
        <div
          ref={panelRef}
          className="fixed inset-0 z-[45] bg-gray-100 text-gray-900 flex flex-col rounded-none overflow-hidden"
          onMouseDown={handleMouseDown}
          onClick={handleClick}
        >
          <div className="flex items-center justify-between px-2 py-1 bg-blue-50 border-b border-blue-200 shrink-0">
            <InlineStack
              gap="1"
              blockAlign="center"
              wrap="nowrap"
              className="min-w-0 flex-1 overflow-hidden"
            >
              <Icon
                name="PanelLeft"
                size="xs"
                className="text-blue-600 shrink-0"
              />
              <Text
                size="xs"
                weight="semibold"
                className="text-gray-700 truncate"
              >
                {title}
              </Text>
            </InlineStack>
            <WindowActions
              windowId={windowId}
              isMinimized={isMinimized}
              isMaximized={isMaximized}
              isActionDisabled={isActionDisabled}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-gray-50">
            <ContentWindowStateProvider value={contentWindowState}>
              {content}
            </ContentWindowStateProvider>
          </div>
        </div>,
        document.body,
      );
    }

    return (
      <>
        <div
          ref={panelRef}
          data-dock-window={windowId}
          className={cn(
            "rounded border overflow-hidden w-full shrink-0",
            "bg-gray-100 text-gray-900 flex flex-col",
            "border-blue-400/50",
            (isDragging || isResizing) && "select-none",
            isDragging && "cursor-grabbing opacity-50",
          )}
          style={{
            height: isMinimized ? "auto" : effectiveDockedHeight,
            minHeight: isMinimized ? undefined : MIN_DOCKED_HEIGHT,
          }}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
        >
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between px-2 py-0.5",
              "cursor-grab border-b shrink-0",
              isDragging && "cursor-grabbing",
              "bg-blue-50 border-blue-200",
            )}
            onMouseDown={handleHeaderMouseDown}
          >
            <InlineStack
              gap="1"
              blockAlign="center"
              wrap="nowrap"
              className="min-w-0 flex-1 overflow-hidden"
            >
              <Icon
                name="GripVertical"
                size="xs"
                className="text-gray-400 shrink-0"
              />
              <Text
                size="xs"
                weight="semibold"
                className="text-gray-700 truncate"
              >
                {title}
              </Text>
            </InlineStack>

            <WindowActions
              windowId={windowId}
              isMinimized={isMinimized}
              isMaximized={isMaximized}
              isActionDisabled={isActionDisabled}
            />
          </div>

          {/* Content */}
          {!isMinimized && (
            <div
              className="flex-1 min-h-0 overflow-auto bg-gray-50"
              style={{ height: effectiveDockedHeight - headerHeight }}
            >
              <ContentWindowStateProvider value={contentWindowState}>
                {content}
              </ContentWindowStateProvider>
            </div>
          )}

          {/* Bottom resize handle for height */}
          {!isMinimized && (
            <div
              className="h-1 cursor-ns-resize hover:bg-blue-200 transition-colors shrink-0"
              onMouseDown={handleDockedResizeMouseDown}
            />
          )}
        </div>

        {isDragging &&
          snapPreview &&
          createPortal(
            <SnapPreview preview={snapPreview} windowWidth={size.width} />,
            document.body,
          )}
      </>
    );
  }

  // --- Floating mode rendering (original) ---

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (moveE: MouseEvent) => {
      const newWidth = Math.max(
        minSize.width,
        startWidth + (moveE.clientX - startX),
      );
      const newHeight = Math.max(
        minSize.height,
        startHeight + (moveE.clientY - startY),
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

  const floatingHeaderHeight = 28;
  const contentHeight = size.height - floatingHeaderHeight;

  const dockedTop = position.y;
  const displayHeight = size.height;

  const windowStyle = isMaximized
    ? {
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 45,
      }
    : {
        left: position.x,
        top: dockedTop + (isDocked ? taskPanelOffset : 0),
        width: isMinimized ? "auto" : size.width,
        height: isMinimized ? "auto" : displayHeight,
        minWidth: minSize.width,
        minHeight: isMinimized ? "auto" : minSize.height,
        zIndex: 20 + zIndex,
      };

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          "fixed rounded shadow-xl border overflow-hidden",
          "bg-gray-100 text-gray-900 flex flex-col",
          (isDragging || isResizing) && "select-none",
          isDragging && "cursor-grabbing",
          isMaximized && "rounded-none",
          "border-gray-400",
        )}
        style={windowStyle}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-2 py-1",
            "cursor-grab border-b shrink-0",
            isDragging && "cursor-grabbing",
            isMaximized && "cursor-default",
            "bg-gray-200 border-gray-300",
          )}
          onMouseDown={isMaximized ? undefined : handleHeaderMouseDown}
        >
          <InlineStack
            gap="1"
            blockAlign="center"
            wrap="nowrap"
            className="min-w-0 flex-1 overflow-hidden"
          >
            {isAttached && (
              <Icon name="Link" size="xs" className="text-green-600 shrink-0" />
            )}
            <Text
              size="xs"
              weight="semibold"
              className="text-gray-700 truncate"
            >
              {title}
            </Text>
          </InlineStack>

          <WindowActions
            windowId={windowId}
            isMinimized={isMinimized}
            isMaximized={isMaximized}
            isActionDisabled={isActionDisabled}
          />
        </div>

        {/* Content */}
        {!isMinimized && (
          <div
            className="flex-1 min-h-0 overflow-auto bg-gray-50"
            style={{
              height: isMaximized
                ? `calc(100vh - ${floatingHeaderHeight}px)`
                : contentHeight,
            }}
          >
            <ContentWindowStateProvider value={contentWindowState}>
              {content}
            </ContentWindowStateProvider>
          </div>
        )}

        {/* Resize handle */}
        {!isMinimized && !isMaximized && (
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-gray-300 rounded-tl-sm transition-colors"
            onMouseDown={handleResizeMouseDown}
          >
            <svg
              className="w-full h-full text-gray-400"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
            </svg>
          </div>
        )}
      </div>

      {isDragging &&
        snapPreview &&
        createPortal(
          <SnapPreview preview={snapPreview} windowWidth={size.width} />,
          document.body,
        )}
    </>
  );
}

// --- Shared window action buttons ---

interface WindowActionsProps {
  windowId: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isActionDisabled: (action: WindowAction) => boolean;
}

function WindowActions({
  windowId,
  isMinimized,
  isMaximized,
  isActionDisabled,
}: WindowActionsProps) {
  return (
    <div
      className="shrink-0 flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!isActionDisabled("minimize") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-gray-700 hover:bg-gray-300"
          onClick={() => toggleMinimize(windowId)}
          title={isMinimized ? "Expand" : "Minimize"}
        >
          <Icon name={isMinimized ? "ChevronDown" : "Minus"} size="xs" />
        </Button>
      )}

      {!isActionDisabled("maximize") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-gray-700 hover:bg-gray-300"
          onClick={() => toggleMaximize(windowId)}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <Icon name={isMaximized ? "Minimize2" : "Maximize2"} size="xs" />
        </Button>
      )}

      {!isActionDisabled("hide") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-gray-700 hover:bg-gray-300"
          onClick={() => hideWindow(windowId)}
          title="Hide to task panel"
        >
          <Icon name="PanelBottomClose" size="xs" />
        </Button>
      )}

      {!isActionDisabled("close") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-300"
          onClick={() => closeWindow(windowId)}
          title="Close"
        >
          <Icon name="X" size="xs" />
        </Button>
      )}
    </div>
  );
}
