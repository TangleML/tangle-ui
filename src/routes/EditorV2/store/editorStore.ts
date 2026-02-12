import { proxy } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";

export interface EditorStore {
  spec: ComponentSpecEntity | null;
  selectedNodeId: string | null;
  selectedNodeType: "task" | "input" | "output" | null;
  /**
   * Version counter incremented after mutations.
   * Used to force React re-renders since class method mutations
   * bypass Valtio's proxy tracking.
   */
  version: number;
}

export const editorStore = proxy<EditorStore>({
  spec: null,
  selectedNodeId: null,
  selectedNodeType: null,
  version: 0,
});

/**
 * Increment version to trigger React re-renders.
 * Call this after any mutation to the spec.
 */
export function notifySpecChanged() {
  editorStore.version++;
}

/**
 * Initialize the editor store with a ComponentSpec.
 *
 * The editorStore is already a Valtio proxy, so assigning to it
 * will auto-wrap the spec. The nested `entities` objects in collections
 * are also proxies (created in EntityIndex), enabling deep reactivity.
 */
export function initializeStore(spec: ComponentSpecEntity) {
  // Assign directly - editorStore is a proxy and will handle nested objects
  // The entities objects in collections are already proxies for reactivity
  editorStore.spec = spec;
  editorStore.selectedNodeId = null;
  editorStore.selectedNodeType = null;
}

/**
 * Select a node by its ID and type.
 */
export function selectNode(
  nodeId: string | null,
  nodeType: EditorStore["selectedNodeType"] = null,
) {
  editorStore.selectedNodeId = nodeId;
  editorStore.selectedNodeType = nodeType;
}

/**
 * Clear the current selection.
 */
export function clearSelection() {
  editorStore.selectedNodeId = null;
  editorStore.selectedNodeType = null;
}
