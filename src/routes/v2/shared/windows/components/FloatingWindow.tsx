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

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const resizeHandleClasses: Record<ResizeDirection, string> = {
  n: "absolute top-0 left-3 right-3 h-1 cursor-n-resize",
  s: "absolute bottom-0 left-3 right-3 h-1 cursor-s-resize",
  e: "absolute right-0 top-3 bottom-3 w-1 cursor-e-resize",
  w: "absolute left-0 top-3 bottom-3 w-1 cursor-w-resize",
  ne: "absolute top-0 right-0 w-3 h-3 cursor-ne-resize",
  nw: "absolute top-0 left-0 w-3 h-3 cursor-nw-resize",
  se: "absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-gray-300 rounded-tl-sm transition-colors",
  sw: "absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize",
};

function ResizeHandles({
  onResizeStart,
}: {
  onResizeStart: (direction: ResizeDirection) => React.MouseEventHandler;
}) {
  return (
    <>
      {(Object.keys(resizeHandleClasses) as ResizeDirection[]).map((dir) => (
        <div
          key={dir}
          className={resizeHandleClasses[dir]}
          onMouseDown={onResizeStart(dir)}
        >
          {dir === "se" && (
            <svg
              className="w-full h-full text-gray-400"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
            </svg>
          )}
        </div>
      ))}
    </>
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

  const handleResizeMouseDown =
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = model.size.width;
      const startHeight = model.size.height;
      const startPosX = model.position.x;
      const startPosY = model.position.y;

      const resizeRight = direction.includes("e");
      const resizeLeft = direction.includes("w");
      const resizeBottom = direction.includes("s");
      const resizeTop = direction.includes("n");

      const onMouseMove = (moveE: MouseEvent) => {
        const dx = moveE.clientX - startX;
        const dy = moveE.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startPosX;
        let newY = startPosY;

        if (resizeRight) {
          newWidth = Math.max(model.minSize.width, startWidth + dx);
        } else if (resizeLeft) {
          newWidth = Math.max(model.minSize.width, startWidth - dx);
          newX = startPosX + (startWidth - newWidth);
        }

        if (resizeBottom) {
          newHeight = Math.max(model.minSize.height, startHeight + dy);
        } else if (resizeTop) {
          newHeight = Math.max(model.minSize.height, startHeight - dy);
          newY = startPosY + (startHeight - newHeight);
        }

        model.updateSize({ width: newWidth, height: newHeight });
        if (resizeLeft || resizeTop) {
          model.updatePosition({ x: newX, y: newY });
        }
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
          <ResizeHandles onResizeStart={handleResizeMouseDown} />
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
