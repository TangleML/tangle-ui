import { proxy } from "valtio";

import type { ComponentSpec } from "@/models/componentSpec";

/** Represents a selected node in multi-selection */
export interface SelectedNode {
  id: string;
  type: "task" | "input" | "output";
  position: { x: number; y: number };
}

/**
 * Store ComponentSpec entity OUTSIDE of Valtio proxy.
 * Valtio's proxy/snapshot mechanism breaks accessor decorators that use private fields.
 */
let _spec: ComponentSpec | null = null;

interface EditorStore {
  /** Trigger for spec changes (increment to notify) */
  specVersion: number;
  selectedNodeId: string | null;
  selectedNodeType: "task" | "input" | "output" | null;
  /** Tracks if shift key was held during last selection (for pinned windows) */
  lastSelectionWasShiftClick: boolean;
  /** Entity ID from the last shift-click (for creating pinned window) */
  lastShiftClickEntityId: string | null;
  /** Array of selected nodes for multi-selection */
  multiSelection: SelectedNode[];
  /** The ComponentSpec (stored outside proxy, accessed via getter) */
  readonly spec: ComponentSpec | null;
}

// Cast through unknown because spec/rootSpec/nestedSpecs are added via Object.defineProperty
export const editorStore = proxy<EditorStore>({
  specVersion: 0,
  selectedNodeId: null,
  selectedNodeType: null,
  lastSelectionWasShiftClick: false,
  lastShiftClickEntityId: null,
  multiSelection: [],
} as unknown as EditorStore);

/** Getter for the actual spec object (outside of Valtio) */
export function getSpec(): ComponentSpec | null {
  return _spec;
}

/** For backward compatibility - access spec directly */
Object.defineProperty(editorStore, "spec", {
  get: () => _spec,
  enumerable: false,
});

/**
 * Initialize the editor store with a ComponentSpec.
 *
 * The new model uses EventTarget-based reactivity via BaseEntity and ObservableArray.
 * Valtio is still used for the editor store itself (selection state, etc.)
 */
export function initializeStore(spec: ComponentSpec) {
  _spec = spec;
  editorStore.specVersion++;
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
  editorStore.lastShiftClickEntityId = isShiftClick
    ? (options?.entityId ?? null)
    : null;

  // If it's a shift-click, don't change the current selection
  // The window system will handle creating a pinned window
  if (isShiftClick) {
    return;
  }

  editorStore.selectedNodeId = nodeId;
  editorStore.selectedNodeType = nodeType;
}

/**
 * Clear the spec from the store.
 */
export function clearSpec() {
  _spec = null;
  editorStore.specVersion++;
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
