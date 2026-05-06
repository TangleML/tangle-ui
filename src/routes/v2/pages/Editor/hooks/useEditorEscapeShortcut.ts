import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { ESCAPE } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

function hasReactFlowSelection(
  reactFlow: ReturnType<typeof useReactFlow>,
): boolean {
  return (
    reactFlow.getNodes().some((n) => n.selected) ||
    reactFlow.getEdges().some((e) => e.selected)
  );
}

/**
 * Centralized ESC handler for the editor. Priority:
 *   1. If a dialog is open, return false so Radix's portal handler closes it.
 *   2. Restore the front-most maximized window (if any).
 *   3. Otherwise clear ReactFlow + editor selection state.
 * Returns false when nothing applies, so the event keeps propagating.
 */
export function useEditorEscapeShortcut(): void {
  const { stack } = useDialog();
  const { editor, keyboard, windows } = useSharedStores();
  const reactFlow = useReactFlow();

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

        const rfSelected = hasReactFlowSelection(reactFlow);
        const editorSelected = editor.hasAnySelection;
        if (!rfSelected && !editorSelected) return false;

        editor.clearSelection();
        if (rfSelected) {
          reactFlow.setNodes((ns) =>
            ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
          );
          reactFlow.setEdges((es) =>
            es.map((e) => (e.selected ? { ...e, selected: false } : e)),
          );
        }
      },
    });
    return unregister;
  }, [editor, keyboard, reactFlow, stack, windows]);
}
