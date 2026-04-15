import { useEffect } from "react";

interface UseCopyPasteProps {
  onCopy: () => void;
  onPaste: () => void;
}

export function useCopyPaste({ onCopy, onPaste }: UseCopyPasteProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const copyKey = isMac ? event.metaKey : event.ctrlKey;

      const target = event.target as HTMLElement;

      // Check if the target is editable
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.closest(".monaco-editor") !== null;

      // Check if there is a text selection
      const selection = window.getSelection();
      const hasSelectionText =
        selection && selection.toString().trim().length > 0;

      if (isEditable || hasSelectionText) return;

      if (copyKey && event.key === "c") {
        event.preventDefault();
        onCopy();
      }

      if (copyKey && event.key === "v") {
        event.preventDefault();
        onPaste();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCopy, onPaste]);
}
