import { type DragEvent, useRef, useState } from "react";

function carriesFiles(event: DragEvent) {
  return event.dataTransfer.types.includes("Files");
}

export function useFileDrop(onFile: (file: File) => void) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // dragenter and dragleave fire again on every child the pointer crosses, so a
  // single dragleave does not mean the drag has left the target.
  const dragDepth = useRef(0);

  const onDragEnter = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    dragDepth.current += 1;
    setIsDraggingFile(true);
  };

  const onDragOver = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDraggingFile(false);
  };

  const onDrop = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDraggingFile(false);

    const [file] = event.dataTransfer.files;
    if (file) onFile(file);
  };

  return {
    isDraggingFile,
    dropTargetProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
