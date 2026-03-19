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
  DEFAULT_DOCKED_HEIGHT,
  MIN_DOCKED_HEIGHT,
  type WindowAction,
} from "@/routes/v2/shared/windows/types";
import {
  getWindowById,
  getWindowContent,
  isDockAreaCollapsed,
  updateDockedWindowHeight,
} from "@/routes/v2/shared/windows/windows.actions";

import { WindowActions } from "./WindowActions";
import { WindowHeader } from "./WindowHeader";

interface DockedWindowProps {
  windowId: string;
}

const HEADER_HEIGHT = 26;

export const DockedWindow = observer(function DockedWindow({
  windowId,
}: DockedWindowProps) {
  const windowConfig = getWindowById(windowId);
  if (!windowConfig) return null;

  const {
    title,
    state,
    size,
    disabledActions,
    dockState,
    attachedTo,
    dockedHeight,
  } = windowConfig;

  const content = getWindowContent(windowId);
  const isMinimized = state === "minimized";
  const isMaximized = state === "maximized";
  const isDocked = dockState === "left" || dockState === "right";
  const isAttached = !!attachedTo;
  const effectiveDockedHeight = dockedHeight ?? DEFAULT_DOCKED_HEIGHT;
  const dockAreaCollapsed = isDockAreaCollapsed(dockState);

  const {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  } = useWindowDrag({ windowId, docked: true });

  const [isResizing, setIsResizing] = useState(false);

  const isActionDisabled = (action: WindowAction) =>
    disabledActions?.includes(action) ?? false;

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

  const actions = (
    <WindowActions
      windowId={windowId}
      isMinimized={isMinimized}
      isMaximized={isMaximized}
      isActionDisabled={isActionDisabled}
    />
  );

  if (isMaximized) {
    return createPortal(
      <div
        ref={panelRef}
        className="fixed inset-0 z-[45] bg-gray-100 text-gray-900 flex flex-col rounded-none overflow-hidden"
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={title}
          leadingIcon={
            <Icon
              name="PanelLeft"
              size="xs"
              className="text-blue-600 shrink-0"
            />
          }
          actions={actions}
          className="py-1 bg-blue-50 border-blue-200"
        />
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
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={title}
          isDragging={isDragging}
          onMouseDown={handleHeaderMouseDown}
          leadingIcon={
            <Icon
              name="GripVertical"
              size="xs"
              className="text-gray-400 shrink-0"
            />
          }
          actions={actions}
          className="py-0.5 bg-blue-50 border-blue-200"
        />

        {!isMinimized && (
          <div
            className="flex-1 min-h-0 overflow-auto bg-gray-50"
            style={{ height: effectiveDockedHeight - HEADER_HEIGHT }}
          >
            <ContentWindowStateProvider value={contentWindowState}>
              {content}
            </ContentWindowStateProvider>
          </div>
        )}

        {!isMinimized && (
          <div
            className="h-1 cursor-ns-resize hover:bg-blue-200 transition-colors shrink-0"
            onMouseDown={handleResizeMouseDown}
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
});
