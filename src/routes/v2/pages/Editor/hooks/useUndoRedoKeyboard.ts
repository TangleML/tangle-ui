import { useEffect } from "react";

import { undoStore } from "@/routes/v2/pages/Editor/store/undoStore";
import { CMDALT, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { registerShortcut } from "@/routes/v2/shared/store/keyboardStore";

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
