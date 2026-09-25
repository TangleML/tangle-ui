import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";

/**
 * Every spec mutation the bridge makes runs inside an undo group, so the undo
 * store is the one seam that catches all of them — and only them, since
 * nothing the user does on the canvas goes through the bridge's copy. Asking
 * for a fit here keeps an agent's growing graph in frame without the bridge or
 * the CSOM handlers knowing that a viewport exists.
 */
export function fitViewAfterEdits(
  undo: UndoGroupable,
  editor: EditorStore,
): UndoGroupable {
  return {
    withGroup(label, fn) {
      const result = undo.withGroup(label, fn);
      editor.requestFitView();
      return result;
    },
  };
}
