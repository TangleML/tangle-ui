import { observer } from "mobx-react-lite";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ContentWindowState } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { ContentWindowStateProvider } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { useWindowDrag } from "@/routes/v2/shared/windows/hooks/useWindowDrag";
import { SnapPreview } from "@/routes/v2/shared/windows/SnapPreview";
import {
  TASK_PANEL_HEIGHT,
  type WindowAction,
} from "@/routes/v2/shared/windows/types";
import {
  getWindowById,
  getWindowContent,
  getWindowZIndex,
  hasHiddenWindows as checkHasHiddenWindows,
  isDockAreaCollapsed,
  updateWindowSize,
} from "@/routes/v2/shared/windows/windows.actions";

import { WindowActions } from "./WindowActions";
import { WindowHeader } from "./WindowHeader";

interface FloatingWindowProps {
  windowId: string;
}

const HEADER_HEIGHT = 28;

export const FloatingWindow = observer(function FloatingWindow({
  windowId,
}: FloatingWindowProps) {
  const windowConfig = getWindowById(windowId);
  const zIndex = getWindowZIndex(windowId);

  if (!windowConfig) return null;

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

  const content = getWindowContent(windowId);
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";
  const isDocked = dockState === "left" || dockState === "right";
  const isAttached = !!attachedTo;

  const taskPanelOffset = checkHasHiddenWindows() ? TASK_PANEL_HEIGHT : 0;

  const {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  } = useWindowDrag({ windowId, docked: false });

  const [isResizing, setIsResizing] = useState(false);

  const isActionDisabled = (action: WindowAction) =>
    disabledActions?.includes(action) ?? false;

  const dockAreaCollapsed = isDockAreaCollapsed(dockState);

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

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const onMouseMove = (moveE: MouseEvent) => {
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

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const contentHeight = size.height - HEADER_HEIGHT;

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
        top: position.y + (isDocked ? taskPanelOffset : 0),
        width: isMinimized ? "auto" : size.width,
        height: isMinimized ? "auto" : size.height,
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
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={title}
          isDragging={isDragging}
          onMouseDown={isMaximized ? undefined : handleHeaderMouseDown}
          leadingIcon={
            isAttached ? (
              <Icon name="Link" size="xs" className="text-green-600 shrink-0" />
            ) : undefined
          }
          actions={
            <WindowActions
              windowId={windowId}
              isMinimized={isMinimized}
              isMaximized={isMaximized}
              isActionDisabled={isActionDisabled}
            />
          }
          className={cn(
            "py-1",
            isMaximized && "cursor-default",
            "bg-gray-200 border-gray-300",
          )}
        />

        {!isMinimized && (
          <div
            className="flex-1 min-h-0 overflow-auto bg-gray-50"
            style={{
              height: isMaximized
                ? `calc(100vh - ${HEADER_HEIGHT}px)`
                : contentHeight,
            }}
          >
            <ContentWindowStateProvider value={contentWindowState}>
              {content}
            </ContentWindowStateProvider>
          </div>
        )}

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
});
