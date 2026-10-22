import { useEffect } from "react";

import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { ESCAPE } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Centralized ESC handler for the editor. Priority:
 *   1. If a dialog is open, return false so Radix's portal handler closes it.
 *   2. Restore the front-most maximized window (if any).
 *   3. Otherwise clear the editor selection.
 * Returns false when nothing applies, so the event keeps propagating.
 */
export function useEditorEscapeShortcut(): void {
  const { stack } = useDialog();
  const { editor, keyboard, windows } = useSharedStores();

  useEffect(() => {
    const unregister = keyboard.registerShortcut({
      id: "editor-escape",
      keys: [ESCAPE],
      label: "Dismiss / clear selection",
      allowInEditable: true,
      action: () => {
        if (stack.length > 0) return false;

        const front = windows.getFrontMaximizedWindow();
        if (front) {
          front.restore();
          return;
        }

        if (!editor.hasAnySelection) {
          return false;
        }

        editor.clearSelection();
      },
    });
    return unregister;
  }, [editor, keyboard, stack, windows]);
}
