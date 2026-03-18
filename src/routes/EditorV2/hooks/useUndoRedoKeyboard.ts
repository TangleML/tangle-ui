import { useEffect } from "react";

import { CMDALT, SHIFT } from "@/routes/EditorV2/shortcuts/keys";
import { registerShortcut } from "@/routes/EditorV2/store/keyboardStore";
import { undoStore } from "@/routes/EditorV2/store/undoStore";

export function useUndoRedoKeyboard(): void {
  useEffect(() => {
    const unregisterUndo = registerShortcut({
      id: "undo",
      keys: [CMDALT, "Z"],
      label: "Undo",
      action: () => undoStore.undo(),
    });

    const unregisterRedo = registerShortcut({
      id: "redo",
      keys: [CMDALT, SHIFT, "Z"],
      label: "Redo",
      action: () => undoStore.redo(),
    });

    const unregisterRedoY = registerShortcut({
      id: "redo-y",
      keys: [CMDALT, "Y"],
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
