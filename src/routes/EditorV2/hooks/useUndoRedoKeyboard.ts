import { useEffect } from "react";

import { registerShortcut } from "../shortcuts/keyboardShortcuts";
import { undoStore } from "../store/undoStore";

export function useUndoRedoKeyboard(): void {
  useEffect(() => {
    const unregisterUndo = registerShortcut({
      id: "undo",
      keys: { mod: true, key: "z" },
      label: "Undo",
      action: () => undoStore.undo(),
    });

    const unregisterRedo = registerShortcut({
      id: "redo",
      keys: { mod: true, shift: true, key: "z" },
      label: "Redo",
      action: () => undoStore.redo(),
    });

    const unregisterRedoY = registerShortcut({
      id: "redo-y",
      keys: { mod: true, key: "y" },
      label: "Redo",
      action: () => undoStore.redo(),
    });

    return () => {
      unregisterUndo();
      unregisterRedo();
      unregisterRedoY();
    };
  }, []);
}
