import { observer } from "mobx-react-lite";
import { useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { useWindowDrag } from "@/routes/v2/shared/windows/hooks/useWindowDrag";
import { SnapPreview } from "@/routes/v2/shared/windows/SnapPreview";
import { TASK_PANEL_HEIGHT } from "@/routes/v2/shared/windows/types";

import { WindowActions } from "./WindowActions";
import { WindowHeader } from "./WindowHeader";

const HEADER_HEIGHT = 28;

export const FloatingWindow = observer(function FloatingWindow() {
  const { model, content } = useWindowContext();
  const { windows } = useSharedStores();

  const {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  } = useWindowDrag({ docked: false });

  const [isResizing, setIsResizing] = useState(false);

  const taskPanelOffset = windows.hasHiddenWindows ? TASK_PANEL_HEIGHT : 0;

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = model.size.width;
    const startHeight = model.size.height;

    const onMouseMove = (moveE: MouseEvent) => {
      const newWidth = Math.max(
        model.minSize.width,
        startWidth + (moveE.clientX - startX),
      );
      const newHeight = Math.max(
        model.minSize.height,
        startHeight + (moveE.clientY - startY),
      );
      model.updateSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const contentHeight = model.size.height - HEADER_HEIGHT;

  const windowStyle = model.isMaximized
    ? {
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 45,
      }
    : {
        left: model.position.x,
        top: model.position.y + (model.isDocked ? taskPanelOffset : 0),
        width: model.isMinimized ? "auto" : model.size.width,
        height: model.isMinimized ? "auto" : model.size.height,
        minWidth: model.minSize.width,
        minHeight: model.isMinimized ? "auto" : model.minSize.height,
        zIndex: 20 + model.zIndex,
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
          model.isMaximized && "rounded-none",
          "border-gray-400",
        )}
        style={windowStyle}
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={model.title}
          isDragging={isDragging}
          onMouseDown={model.isMaximized ? undefined : handleHeaderMouseDown}
          actions={<WindowActions />}
          className={cn(
            "py-1",
            model.isMaximized && "cursor-default",
            "bg-gray-200 border-gray-300",
          )}
        />

        {!model.isMinimized && (
          <div
            className="flex-1 min-h-0 overflow-auto bg-gray-50"
            style={{
              height: model.isMaximized
                ? `calc(100vh - ${HEADER_HEIGHT}px)`
                : contentHeight,
            }}
          >
            {content}
          </div>
        )}

        {!model.isMinimized && !model.isMaximized && (
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
          <SnapPreview preview={snapPreview} windowWidth={model.size.width} />,
          document.body,
        )}
    </>
  );
});
