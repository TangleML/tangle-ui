import { observer } from "mobx-react-lite";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { useWindowDrag } from "@/routes/v2/shared/windows/hooks/useWindowDrag";
import { SnapPreview } from "@/routes/v2/shared/windows/SnapPreview";
import { MIN_DOCKED_HEIGHT } from "@/routes/v2/shared/windows/types";

import { WindowActions } from "./WindowActions";
import { WindowHeader } from "./WindowHeader";

const HEADER_HEIGHT = 26;

export const DockedWindow = observer(function DockedWindow() {
  const { model, content } = useWindowContext();

  const {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  } = useWindowDrag({ docked: true });

  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = model.effectiveDockedHeight;

    const onMouseMove = (moveE: MouseEvent) => {
      const newHeight = Math.max(
        MIN_DOCKED_HEIGHT,
        startHeight + (moveE.clientY - startY),
      );
      model.updateDockedHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const actions = <WindowActions />;

  if (model.isMaximized) {
    return createPortal(
      <div
        ref={panelRef}
        className="fixed inset-0 z-[45] bg-gray-100 text-gray-900 flex flex-col rounded-none overflow-hidden"
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={model.title}
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
        <div className="flex-1 min-h-0 overflow-auto bg-gray-50">{content}</div>
      </div>,
      document.body,
    );
  }

  return (
    <>
      <div
        ref={panelRef}
        data-dock-window={model.id}
        className={cn(
          "rounded border overflow-hidden w-full shrink-0",
          "bg-gray-100 text-gray-900 flex flex-col",
          "border-blue-400/50",
          (isDragging || isResizing) && "select-none",
          isDragging && "cursor-grabbing opacity-50",
        )}
        style={{
          height: model.isMinimized ? "auto" : model.effectiveDockedHeight,
          minHeight: model.isMinimized ? undefined : MIN_DOCKED_HEIGHT,
        }}
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={model.title}
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

        {!model.isMinimized && (
          <div
            className="flex-1 min-h-0 overflow-auto bg-gray-50"
            style={{
              height: model.effectiveDockedHeight - HEADER_HEIGHT,
            }}
          >
            {content}
          </div>
        )}

        {!model.isMinimized && (
          <div
            className="h-1 cursor-ns-resize hover:bg-blue-200 transition-colors shrink-0"
            onMouseDown={handleResizeMouseDown}
          />
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
