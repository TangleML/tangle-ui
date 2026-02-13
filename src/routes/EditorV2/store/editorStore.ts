import { proxy } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";

export interface EditorStore {
  spec: ComponentSpecEntity | null;
  selectedNodeId: string | null;
  selectedNodeType: "task" | "input" | "output" | null;
  /** Tracks if shift key was held during last selection (for pinned windows) */
  lastSelectionWasShiftClick: boolean;
  /** Entity ID from the last shift-click (for creating pinned window) */
  lastShiftClickEntityId: string | null;
}

export const editorStore = proxy<EditorStore>({
  spec: null,
  selectedNodeId: null,
  selectedNodeType: null,
  lastSelectionWasShiftClick: false,
  lastShiftClickEntityId: null,
});

/**
 * Initialize the editor store with a ComponentSpec.
 *
 * The spec is already proxied from YamlLoader, and all nested collections
 * and entities are wrapped with proxy() for native Valtio reactivity.
 */
export function initializeStore(spec: ComponentSpecEntity) {
  editorStore.spec = spec;
  editorStore.selectedNodeId = null;
  editorStore.selectedNodeType = null;
  editorStore.lastSelectionWasShiftClick = false;
  editorStore.lastShiftClickEntityId = null;
}

/**
 * Select a node by its ID and type.
 * @param nodeId - The flow node ID
 * @param nodeType - The type of node (task, input, output)
 * @param options - Additional options
 * @param options.shiftKey - If true, indicates this should create a pinned window
 * @param options.entityId - The entity ID (different from nodeId for tasks)
 */
export function selectNode(
  nodeId: string | null,
  nodeType: EditorStore["selectedNodeType"] = null,
  options?: { shiftKey?: boolean; entityId?: string },
) {
  const isShiftClick = options?.shiftKey ?? false;

  // Track shift-click for pinned window creation
  editorStore.lastSelectionWasShiftClick = isShiftClick;
  editorStore.lastShiftClickEntityId = isShiftClick ? (options?.entityId ?? null) : null;

  // If it's a shift-click, don't change the current selection
  // The window system will handle creating a pinned window
  if (isShiftClick) {
    return;
  }

  editorStore.selectedNodeId = nodeId;
  editorStore.selectedNodeType = nodeType;
}

/**
 * Clear the current selection.
 */
export function clearSelection() {
  editorStore.selectedNodeId = null;
  editorStore.selectedNodeType = null;
  editorStore.lastSelectionWasShiftClick = false;
  editorStore.lastShiftClickEntityId = null;
}
