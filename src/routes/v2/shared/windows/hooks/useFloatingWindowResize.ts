import { useState } from "react";

import type { WindowModel } from "@/routes/v2/shared/windows/windowModel";

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * 8-direction mouse-driven resize for a floating window. Updates `size` and
 * (for top/left handles) `position` on the model, clamped by `model.minSize`.
 * Disables auto-fit on first interaction.
 */
export function useFloatingWindowResize(model: WindowModel) {
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart =
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      model.disableAutoSize();

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

  return { isResizing, handleResizeStart };
}
