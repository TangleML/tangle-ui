import type { EditorStore } from "@/routes/v2/shared/store/editorStore";

/**
 * Whether a canvas node should render the "selected" ring.
 *
 * When `editor.selectedNodeId` is set (single selection from store), only
 * that node is highlighted — React Flow's `selected` prop can lag one frame
 * after switching nodes, which would otherwise show two rings if OR'd
 * blindly with the store.
 *
 * When `editor.multiSelection` is non-empty, the store list is authoritative.
 * Otherwise fall back to React Flow's `selected` (rectangle drag before
 * debounced multi-selection sync, or RF-only state).
 */
export function isEditorVisualNodeSelected(
  editor: EditorStore,
  nodeId: string,
  rfSelected: boolean,
): boolean {
  if (editor.selectedNodeId !== null) {
    return editor.selectedNodeId === nodeId;
  }
  if (editor.multiSelection.length > 0) {
    return editor.multiSelection.some((n) => n.id === nodeId);
  }
  return rfSelected;
}
