import { type DragEvent, useRef, useState } from "react";

const DRAG_MIME = "application/x-folder-move";
export function useFolderDragDrop(
  canAcceptDrop: boolean,
  onItemDrop: ((data: string) => void) | undefined,
) {
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;

    if (canAcceptDrop) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const data = e.dataTransfer.getData(DRAG_MIME);
    if (data && onItemDrop) {
      onItemDrop(data);
    }
  };

  return {
    isDragOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
  };
}
export function handleDragStart(
  e: DragEvent,
  dragData: string | undefined,
  dragItemCount: number | undefined,
  onDragStateChange: ((isDragging: boolean) => void) | undefined,
) {
  if (!dragData) return;
  e.dataTransfer.setData(DRAG_MIME, dragData);
  e.dataTransfer.effectAllowed = "move";
  if (dragItemCount && dragItemCount > 1) {
    const ghost = document.createElement("div");
    ghost.style.cssText =
      "position:fixed;top:-1000px;left:-1000px;padding:6px 12px;border-radius:6px;font-size:14px;font-weight:500;color:white;background:#0f172a;box-shadow:0 4px 12px rgba(0,0,0,0.15);white-space:nowrap;";
    ghost.textContent = `${dragItemCount} items`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  }
  onDragStateChange?.(true);
}
