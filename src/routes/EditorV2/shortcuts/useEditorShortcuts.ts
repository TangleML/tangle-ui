import { useEffect } from "react";

import { getShortcuts } from "./keyboardShortcuts";
import { isEditableTarget, matchesShortcut } from "./shortcutUtils";

/**
 * Single keydown listener that dispatches to all registered shortcuts.
 * Call once at the EditorV2 root level.
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const editable = isEditableTarget(event.target);

      for (const shortcut of getShortcuts()) {
        if (editable && !shortcut.allowInEditable) continue;
        if (matchesShortcut(event, shortcut.keys)) {
          event.preventDefault();
          shortcut.action(event);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
