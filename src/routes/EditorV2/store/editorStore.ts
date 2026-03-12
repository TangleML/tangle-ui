import { action, makeObservable, observable } from "mobx";

import type { ValidationIssue } from "@/models/componentSpec";

export type NodeEntityType = "task" | "input" | "output" | "conduit";

export interface SelectedNode {
  id: string;
  type: NodeEntityType;
  position: { x: number; y: number };
}

class EditorStore {
  @observable accessor selectedNodeId: string | null = null;
  @observable accessor selectedNodeType: NodeEntityType | null = null;
  @observable accessor lastSelectionWasShiftClick = false;
  @observable accessor lastShiftClickEntityId: string | null = null;
  @observable.shallow accessor multiSelection: SelectedNode[] = [];
  @observable accessor focusedArgumentName: string | null = null;
  @observable accessor hoveredEntityId: string | null = null;
  @observable accessor pendingFocusNodeId: string | null = null;
  @observable.ref accessor selectedValidationIssue: ValidationIssue | null =
    null;

  constructor() {
    makeObservable(this);
  }

  @action resetState() {
    this.selectedNodeId = null;
    this.selectedNodeType = null;
    this.lastSelectionWasShiftClick = false;
    this.lastShiftClickEntityId = null;
    this.multiSelection = [];
    this.focusedArgumentName = null;
    this.hoveredEntityId = null;
    this.pendingFocusNodeId = null;
    this.selectedValidationIssue = null;
  }

  @action selectNode(
    nodeId: string | null,
    nodeType: NodeEntityType | null = null,
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

  @action setFocusedArgument(name: string | null) {
    this.focusedArgumentName = name;
  }

  @action clearSelection() {
    this.selectedNodeId = null;
    this.selectedNodeType = null;
    this.lastSelectionWasShiftClick = false;
    this.lastShiftClickEntityId = null;
    this.multiSelection = [];
    this.focusedArgumentName = null;
    this.selectedValidationIssue = null;
  }

  @action setMultiSelection(nodes: SelectedNode[]) {
    this.multiSelection = nodes;
    if (nodes.length > 1) {
      this.selectedNodeId = null;
      this.selectedNodeType = null;
    }
  }

  @action clearMultiSelection() {
    this.multiSelection = [];
  }

  @action setHoveredEntity(id: string | null) {
    this.hoveredEntityId = id;
  }

  @action setPendingFocusNode(nodeId: string | null) {
    this.pendingFocusNodeId = nodeId;
  }

  @action setSelectedValidationIssue(issue: ValidationIssue | null) {
    this.selectedValidationIssue = issue;
  }
}

export const editorStore = new EditorStore();

export function resetEditorState() {
  editorStore.resetState();
}

export function selectNode(
  nodeId: string | null,
  nodeType: NodeEntityType | null = null,
  options?: { shiftKey?: boolean; entityId?: string },
) {
  editorStore.selectNode(nodeId, nodeType, options);
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

export function setSelectedValidationIssue(issue: ValidationIssue | null) {
  editorStore.setSelectedValidationIssue(issue);
}
