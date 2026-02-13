import { proxy } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";

/** Represents a selected node in multi-selection */
export interface SelectedNode {
  id: string;
  type: "task" | "input" | "output";
  position: { x: number; y: number };
}

export interface EditorStore {
  spec: ComponentSpecEntity | null;
  selectedNodeId: string | null;
  selectedNodeType: "task" | "input" | "output" | null;
  /** Tracks if shift key was held during last selection (for pinned windows) */
  lastSelectionWasShiftClick: boolean;
  /** Entity ID from the last shift-click (for creating pinned window) */
  lastShiftClickEntityId: string | null;
  /** Array of selected nodes for multi-selection */
  multiSelection: SelectedNode[];
}

export const editorStore = proxy<EditorStore>({
  spec: null,
  selectedNodeId: null,
  selectedNodeType: null,
  lastSelectionWasShiftClick: false,
  lastShiftClickEntityId: null,
  multiSelection: [],
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
  editorStore.multiSelection = [];
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
  editorStore.multiSelection = [];
}

/**
 * Set multi-selection state.
 * @param nodes - Array of selected nodes
 */
export function setMultiSelection(nodes: SelectedNode[]) {
  editorStore.multiSelection = nodes;
  // Clear single selection when multi-selecting
  if (nodes.length > 1) {
    editorStore.selectedNodeId = null;
    editorStore.selectedNodeType = null;
  }
}

/**
 * Clear multi-selection state.
 */
export function clearMultiSelection() {
  editorStore.multiSelection = [];
}
