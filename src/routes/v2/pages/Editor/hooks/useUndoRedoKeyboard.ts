import { useEffect } from "react";

import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useUndoRedoKeyboard(): void {
  const { undo } = useEditorSession();
  const { keyboard } = useSharedStores();

  useEffect(() => {
    const unregisterUndo = keyboard.registerShortcut({
      id: "undo",
      keys: [CMD_OR_CTRL, "Z"],
      label: "Undo",
      action: () => undo.undo(),
    });

    const unregisterRedo = keyboard.registerShortcut({
      id: "redo",
      keys: [CMD_OR_CTRL, SHIFT, "Z"],
      label: "Redo",
      action: () => undo.redo(),
    });

    const unregisterRedoY = keyboard.registerShortcut({
      id: "redo-y",
      keys: [CMD_OR_CTRL, "Y"],
      label: "Redo",
      action: () => undo.redo(),
    });

    return () => {
      unregisterUndo();
      unregisterRedo();
      unregisterRedoY();
    };
  }, [keyboard, undo]);
}
