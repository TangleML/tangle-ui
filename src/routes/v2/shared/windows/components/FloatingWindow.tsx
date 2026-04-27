import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import { type CSSProperties, useState } from "react";
import { createPortal } from "react-dom";

import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { useWindowDrag } from "@/routes/v2/shared/windows/hooks/useWindowDrag";
import { SnapPreview } from "@/routes/v2/shared/windows/SnapPreview";
import type { WindowModel } from "@/routes/v2/shared/windows/windowModel";

import { WindowActions } from "./WindowActions";
import { WindowHeader } from "./WindowHeader";

const HEADER_HEIGHT = 28;

const containerVariants = cva(
  "fixed shadow-xl border overflow-hidden bg-gray-100 text-gray-900 flex flex-col border-gray-400",
  {
    variants: {
      interacting: { true: "select-none", false: "" },
      dragging: { true: "cursor-grabbing", false: "" },
      maximized: { true: "rounded-none", false: "rounded" },
    },
    defaultVariants: {
      interacting: false,
      dragging: false,
      maximized: false,
    },
  },
);

const headerVariants = cva("py-1 bg-gray-800 border-gray-700", {
  variants: {
    maximized: { true: "cursor-default", false: "" },
  },
  defaultVariants: { maximized: false },
});

function getWindowStyle(model: WindowModel): CSSProperties {
  if (model.isMaximized) {
    return { left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 45 };
  }

  return {
    left: model.position.x,
    top: model.position.y,
    width: model.size.width,
    height: model.size.height,
    minWidth: model.minSize.width,
    minHeight: model.minSize.height,
    zIndex: 20 + model.zIndex,
  };
}

function getContentHeight(model: WindowModel): string | number {
  if (model.isMaximized) return `calc(100vh - ${HEADER_HEIGHT}px)`;
  return model.size.height - HEADER_HEIGHT;
}

function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: React.MouseEventHandler;
}) {
  return (
    <div
      className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-gray-300 rounded-tl-sm transition-colors"
      onMouseDown={onMouseDown}
    >
      <svg
        className="w-full h-full text-gray-400"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
      </svg>
    </div>
  );
}

function SnapPreviewPortal({
  snapPreview,
  windowWidth,
}: {
  snapPreview: NonNullable<ReturnType<typeof useWindowDrag>["snapPreview"]>;
  windowWidth: number;
}) {
  return createPortal(
    <SnapPreview preview={snapPreview} windowWidth={windowWidth} />,
    document.body,
  );
}

export const FloatingWindow = observer(function FloatingWindow() {
  const { model, content } = useWindowContext();

  const {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  } = useWindowDrag({ docked: false });

  const [isResizing, setIsResizing] = useState(false);

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

  return (
    <>
      <div
        ref={panelRef}
        className={containerVariants({
          interacting: isDragging || isResizing,
          dragging: isDragging,
          maximized: model.isMaximized,
        })}
        style={getWindowStyle(model)}
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={model.title}
          isDragging={isDragging}
          onMouseDown={model.isMaximized ? undefined : handleHeaderMouseDown}
          actions={<WindowActions />}
          className={headerVariants({ maximized: model.isMaximized })}
          tone="dark"
        />

        <div
          className="flex-1 min-h-0 overflow-auto bg-gray-50"
          style={{ height: getContentHeight(model) }}
        >
          {content}
        </div>

        {!model.isMaximized && (
          <ResizeHandle onMouseDown={handleResizeMouseDown} />
        )}
      </div>

      {isDragging && snapPreview && (
        <SnapPreviewPortal
          snapPreview={snapPreview}
          windowWidth={model.size.width}
        />
      )}
    </>
  );
});
