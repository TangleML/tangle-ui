import { action, computed, makeObservable, observable } from "mobx";

import type { ValidationIssue } from "@/models/componentSpec";

export type NodeEntityType = "task" | "input" | "output" | "conduit" | "flex";

export interface SelectedNode {
  id: string;
  type: NodeEntityType;
  position: { x: number; y: number };
}

export class EditorStore {
  @observable accessor selectedNodeId: string | null = null;
  @observable accessor selectedNodeType: NodeEntityType | null = null;
  @observable accessor lastSelectionWasShiftClick = false;
  @observable accessor lastShiftClickEntityId: string | null = null;
  @observable.shallow accessor multiSelection: SelectedNode[] = [];
  @observable accessor focusedArgumentName: string | null = null;
  @observable accessor hoveredEntityId: string | null = null;
  @observable accessor pendingFocusNodeId: string | null = null;
  @observable accessor spotlightNodeId: string | null = null;
  @observable.ref accessor selectedValidationIssue: ValidationIssue | null =
    null;

  private spotlightTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.spotlightNodeId = null;
    if (this.spotlightTimer !== null) {
      clearTimeout(this.spotlightTimer);
      this.spotlightTimer = null;
    }
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
    this.hoveredEntityId = null;
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
    this.hoveredEntityId = null;
    this.selectedValidationIssue = null;
  }

  @computed get hasAnySelection(): boolean {
    return (
      this.selectedNodeId !== null ||
      this.selectedNodeType !== null ||
      this.multiSelection.length > 0 ||
      this.selectedValidationIssue !== null ||
      this.focusedArgumentName !== null
    );
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

  /**
   * Briefly spotlight a node (e.g. one just placed on the canvas). Auto-clears
   * after the reveal animation so the effect plays once.
   */
  @action setSpotlightNode(nodeId: string | null) {
    this.spotlightNodeId = nodeId;
    if (this.spotlightTimer !== null) {
      clearTimeout(this.spotlightTimer);
      this.spotlightTimer = null;
    }
    if (nodeId !== null) {
      this.spotlightTimer = setTimeout(
        action(() => {
          this.spotlightNodeId = null;
          this.spotlightTimer = null;
        }),
        1300,
      );
    }
  }

  @action setSelectedValidationIssue(issue: ValidationIssue | null) {
    this.selectedValidationIssue = issue;
  }

  /** True when this task is the sole selection or part of a canvas multi-selection. */
  isTaskSelected(taskId: string): boolean {
    if (this.selectedNodeType === "task" && this.selectedNodeId === taskId) {
      return true;
    }
    return this.multiSelection.some(
      (n) => n.type === "task" && n.id === taskId,
    );
  }
}
