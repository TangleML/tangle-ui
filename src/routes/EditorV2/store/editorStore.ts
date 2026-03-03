import { action, makeObservable, observable } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";

export interface SelectedNode {
  id: string;
  type: "task" | "input" | "output";
  position: { x: number; y: number };
}

class EditorStore {
  spec: ComponentSpec | null = null;
  selectedNodeId: string | null = null;
  selectedNodeType: "task" | "input" | "output" | null = null;
  lastSelectionWasShiftClick = false;
  lastShiftClickEntityId: string | null = null;
  multiSelection: SelectedNode[] = [];
  focusedArgumentName: string | null = null;
  hoveredEntityId: string | null = null;
  pendingFocusNodeId: string | null = null;

  constructor() {
    makeObservable(this, {
      spec: observable.ref,
      selectedNodeId: observable,
      selectedNodeType: observable,
      lastSelectionWasShiftClick: observable,
      lastShiftClickEntityId: observable,
      multiSelection: observable.shallow,
      focusedArgumentName: observable,
      hoveredEntityId: observable,
      pendingFocusNodeId: observable,
      initializeStore: action,
      selectNode: action,
      clearSpec: action,
      clearSelection: action,
      setMultiSelection: action,
      clearMultiSelection: action,
      setFocusedArgument: action,
      setHoveredEntity: action,
      setPendingFocusNode: action,
    });
  }

  initializeStore(spec: ComponentSpec) {
    this.spec = spec;
    this.selectedNodeId = null;
    this.selectedNodeType = null;
    this.lastSelectionWasShiftClick = false;
    this.lastShiftClickEntityId = null;
    this.multiSelection = [];
    this.focusedArgumentName = null;
    this.hoveredEntityId = null;
    this.pendingFocusNodeId = null;
  }

  selectNode(
    nodeId: string | null,
    nodeType: "task" | "input" | "output" | null = null,
    options?: { shiftKey?: boolean; entityId?: string },
  ) {
    const isShiftClick = options?.shiftKey ?? false;

    this.lastSelectionWasShiftClick = isShiftClick;
    this.lastShiftClickEntityId = isShiftClick
      ? (options?.entityId ?? null)
      : null;

    if (isShiftClick) return;

    this.selectedNodeId = nodeId;
    this.selectedNodeType = nodeType;
    this.focusedArgumentName = null;
  }

  setFocusedArgument(name: string | null) {
    this.focusedArgumentName = name;
  }

  clearSpec() {
    this.spec = null;
  }

  clearSelection() {
    this.selectedNodeId = null;
    this.selectedNodeType = null;
    this.lastSelectionWasShiftClick = false;
    this.lastShiftClickEntityId = null;
    this.multiSelection = [];
    this.focusedArgumentName = null;
  }

  setMultiSelection(nodes: SelectedNode[]) {
    this.multiSelection = nodes;
    if (nodes.length > 1) {
      this.selectedNodeId = null;
      this.selectedNodeType = null;
    }
  }

  clearMultiSelection() {
    this.multiSelection = [];
  }

  setHoveredEntity(id: string | null) {
    this.hoveredEntityId = id;
  }

  setPendingFocusNode(nodeId: string | null) {
    this.pendingFocusNodeId = nodeId;
  }
}

export const editorStore = new EditorStore();

export function initializeStore(spec: ComponentSpec) {
  editorStore.initializeStore(spec);
}

export function selectNode(
  nodeId: string | null,
  nodeType: "task" | "input" | "output" | null = null,
  options?: { shiftKey?: boolean; entityId?: string },
) {
  editorStore.selectNode(nodeId, nodeType, options);
}

export function getSpec(): ComponentSpec | null {
  return editorStore.spec;
}

export function clearSpec() {
  editorStore.clearSpec();
}

export function clearSelection() {
  editorStore.clearSelection();
}

export function setMultiSelection(nodes: SelectedNode[]) {
  editorStore.setMultiSelection(nodes);
}

export function clearMultiSelection() {
  editorStore.clearMultiSelection();
}

export function setFocusedArgument(name: string | null) {
  editorStore.setFocusedArgument(name);
}

export function setHoveredEntity(id: string | null) {
  editorStore.setHoveredEntity(id);
}

export function setPendingFocusNode(nodeId: string | null) {
  editorStore.setPendingFocusNode(nodeId);
}
