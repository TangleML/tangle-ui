import { useEffect } from "react";

import { undoStore } from "../store/undoStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function useUndoRedoKeyboard() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) undoStore.redo();
        else undoStore.undo();
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "y") {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        undoStore.redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
