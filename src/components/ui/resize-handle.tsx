import { type MouseEvent as ReactMouseEvent, useCallback, useRef } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  minWidth?: number;
  maxWidth?: number;
  side?: "left" | "right";
  onDoubleClick?: () => void;
  /** Called while dragging with the width requested before min/max constraints. */
  onResize?: (attemptedWidth: number) => void;
  /** Called when dragging ends with the width requested before min/max constraints. */
  onResizeEnd?: (attemptedWidth: number) => void;
}

export const VerticalResizeHandle = ({
  minWidth = 200,
  maxWidth = 600,
  side = "left",
  onDoubleClick,
  onResize,
  onResizeEnd,
}: ResizeHandleProps) => {
  const parentElementRef = useRef<HTMLElement | null>(null);
  const resizingRef = useRef<{
    startX: number;
    startWidth: number;
    attemptedWidth: number;
  } | null>(null);

  const captureParentElement = useCallback((element: HTMLElement | null) => {
    parentElementRef.current = element?.parentElement ?? null;
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingRef.current || !parentElementRef.current) return;

      const deltaX = e.clientX - resizingRef.current.startX;

      let newWidth: number;
      if (side === "left") {
        newWidth = resizingRef.current.startWidth - deltaX;
      } else {
        newWidth = resizingRef.current.startWidth + deltaX;
      }

      resizingRef.current.attemptedWidth = newWidth;
      onResize?.(newWidth);
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      parentElementRef.current.style.width = `${constrainedWidth}px`;
    },
    [minWidth, maxWidth, side, onResize],
  );

  const handleMouseUp = useCallback(() => {
    const attemptedWidth = resizingRef.current?.attemptedWidth;
    resizingRef.current = null;

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    if (attemptedWidth !== undefined) {
      onResizeEnd?.(attemptedWidth);
    }
  }, [handleMouseMove, onResizeEnd]);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!parentElementRef.current) return;

      resizingRef.current = {
        startX: e.clientX,
        startWidth: parentElementRef.current.offsetWidth,
        attemptedWidth: parentElementRef.current.offsetWidth,
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp],
  );

  return (
    <div
      className={cn(
        "absolute top-0 h-full cursor-col-resize z-10 group",
        side === "left" ? "left-0" : "right-0",
        "w-2 -mx-0.5",
      )}
      ref={captureParentElement}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {/* Thin visible line */}
      <div
        className={cn(
          "absolute top-0 h-full w-px bg-border transition-all pointer-events-none",
          "group-hover:bg-primary/30",
          side === "left" ? "left-0" : "right-0",
        )}
      />

      <Icon
        name="GripVertical"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 pointer-events-none",
          "bg-background/90 backdrop-blur-sm rounded-xs p-1",
          "text-muted-foreground opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200",

          side === "left"
            ? "left-1/2 -translate-x-1/2"
            : "right-1/2 translate-x-1/2",
        )}
      />
    </div>
  );
};
