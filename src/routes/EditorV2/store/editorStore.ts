import { proxy } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";

export interface EditorStore {
  spec: ComponentSpecEntity | null;
  selectedNodeId: string | null;
  selectedNodeType: "task" | "input" | "output" | null;
}

export const editorStore = proxy<EditorStore>({
  spec: null,
  selectedNodeId: null,
  selectedNodeType: null,
});

/**
 * Initialize the editor store with a ComponentSpec.
 * The spec is wrapped with valtio's proxy for reactivity.
 */
export function initializeStore(spec: ComponentSpecEntity) {
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
