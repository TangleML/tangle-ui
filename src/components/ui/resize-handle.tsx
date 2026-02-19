import { useCallback, useRef } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  minWidth?: number;
  maxWidth?: number;
  side?: "left" | "right";
  /** Optional callback for controlled resize. When provided, the component won't modify parent's style directly. */
  onResize?: (width: number) => void;
}

export const VerticalResizeHandle = ({
  minWidth = 200,
  maxWidth = 600,
  side = "left",
  onResize,
}: ResizeHandleProps) => {
  const parentElementRef = useRef<HTMLElement | null>(null);
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

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

      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      if (onResize) {
        onResize(constrainedWidth);
      } else {
        parentElementRef.current.style.width = `${constrainedWidth}px`;
      }
    },
    [minWidth, maxWidth, side, onResize],
  );

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!parentElementRef.current) return;

      resizingRef.current = {
        startX: e.clientX,
        startWidth: parentElementRef.current.offsetWidth,
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
    >
      {/* Thin visible line with shadow */}
      <div
        className={cn(
          "absolute top-0 h-full w-px bg-border transition-all pointer-events-none",
          "group-hover:bg-primary/30",

          side === "left"
            ? "left-1/2 -translate-x-1/2 shadow-[2px_0_8px_rgba(0,0,0,0.08)]"
            : "right-1/2 translate-x-1/2 shadow-[-2px_0_8px_rgba(0,0,0,0.08)]",
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
