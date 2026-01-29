import { Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";

import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { KEYBOARD_SHORTCUTS } from "@/utils/constants";

import TooltipButton from "./Buttons/TooltipButton";

export const UndoRedo = () => {
  const { undoRedo } = useComponentSpec();
  const { undo, redo, canUndo, canRedo } = undoRedo;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest('[data-slot="input"]'));

      // Skip canvas-level undo/redo if an input is focused
      if (isInputFocused) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key === KEYBOARD_SHORTCUTS.UNDO && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if (
          event.key === KEYBOARD_SHORTCUTS.REDO ||
          (event.key === KEYBOARD_SHORTCUTS.UNDO && event.shiftKey)
        ) {
          event.preventDefault();
          redo();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const metaKey = navigator.userAgent.includes("Mac")
    ? KEYBOARD_SHORTCUTS.MAC_META
    : KEYBOARD_SHORTCUTS.WINDOWS_META;

  return (
    <div className="flex gap-1">
      <TooltipButton
        variant="outline"
        size="sm"
        onClick={undo}
        disabled={!canUndo}
        className="h-8 w-8 p-0"
        tooltip={`Undo (${metaKey}+${KEYBOARD_SHORTCUTS.UNDO.toUpperCase()})`}
      >
        <Undo2 className="h-4 w-4" />
      </TooltipButton>
      <TooltipButton
        variant="outline"
        size="sm"
        onClick={redo}
        disabled={!canRedo}
        className="h-8 w-8 p-0"
        tooltip={`Redo (${metaKey}+${KEYBOARD_SHORTCUTS.REDO.toUpperCase()})`}
      >
        <Redo2 className="h-4 w-4" />
      </TooltipButton>
    </div>
  );
};
