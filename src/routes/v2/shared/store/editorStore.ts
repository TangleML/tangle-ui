import { action, computed, makeObservable, observable } from "mobx";

import type { ValidationIssue } from "@/models/componentSpec";

export type NodeEntityType = "task" | "input" | "output" | "conduit" | "flex";

export interface SelectedNode {
  id: string;
  type: NodeEntityType;
  position: { x: number; y: number };
}

export class EditorStore {
  @observable.shallow accessor selectedNodes: SelectedNode[] = [];
  @observable.shallow accessor selectedEdgeIds: string[] = [];
  @observable accessor lastSelectionWasShiftClick = false;
  @observable accessor lastShiftClickEntityId: string | null = null;
  @observable accessor focusedArgumentName: string | null = null;
  @observable accessor hoveredEntityId: string | null = null;
  @observable accessor pendingFocusNodeId: string | null = null;
  @observable accessor fitViewRequestCount = 0;
  @observable accessor pendingTaskDetailTab: string | null = null;
  @observable.ref accessor selectedValidationIssue: ValidationIssue | null =
    null;

  @observable accessor draggedSincePointerDown = false;
  @observable accessor contextPanelRevealCount = 0;

  constructor() {
    makeObservable(this);
  }

  @computed get selectedNodeId(): string | null {
    return this.selectedNodes.length === 1 ? this.selectedNodes[0].id : null;
  }

  @computed get selectedNodeType(): NodeEntityType | null {
    return this.selectedNodes.length === 1 ? this.selectedNodes[0].type : null;
  }

  @computed get multiSelection(): SelectedNode[] {
    return this.selectedNodes.length > 1 ? this.selectedNodes : [];
  }

  @action setDraggedSincePointerDown(value: boolean) {
    this.draggedSincePointerDown = value;
  }

  /**
   * Clicking a node that is already selected changes no selection, so the
   * panel's selection watcher never hears about it. A counter rather than a
   * flag, for the same reason as `requestFitView`.
   */
  @action requestContextPanelReveal() {
    this.contextPanelRevealCount += 1;
  }

  @action resetState() {
    this.selectedNodes = [];
    this.selectedEdgeIds = [];
    this.lastSelectionWasShiftClick = false;
    this.lastShiftClickEntityId = null;
    this.focusedArgumentName = null;
    this.hoveredEntityId = null;
    this.pendingFocusNodeId = null;
    this.fitViewRequestCount = 0;
    this.pendingTaskDetailTab = null;
    this.selectedValidationIssue = null;
    this.draggedSincePointerDown = false;
    this.contextPanelRevealCount = 0;
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

    this.setSelectedNodes(
      nodeId && nodeType
        ? [{ id: nodeId, type: nodeType, position: { x: 0, y: 0 } }]
        : [],
    );
    this.selectedEdgeIds = [];
    this.focusedArgumentName = null;
    this.hoveredEntityId = null;
  }

  @action setFocusedArgument(name: string | null) {
    this.focusedArgumentName = name;
  }

  @action clearSelection() {
    this.selectedNodes = [];
    this.selectedEdgeIds = [];
    this.lastSelectionWasShiftClick = false;
    this.lastShiftClickEntityId = null;
    this.focusedArgumentName = null;
    this.hoveredEntityId = null;
    this.pendingTaskDetailTab = null;
    this.selectedValidationIssue = null;
  }

  @action setPendingTaskDetailTab(tab: string | null) {
    this.pendingTaskDetailTab = tab;
  }

  @computed get hasAnySelection(): boolean {
    return (
      this.selectedNodes.length > 0 ||
      this.selectedEdgeIds.length > 0 ||
      this.selectedValidationIssue !== null ||
      this.focusedArgumentName !== null
    );
  }

  @action setSelectedNodes(nodes: SelectedNode[]) {
    if (
      nodes.length === this.selectedNodes.length &&
      nodes.every(
        (node, index) =>
          node.id === this.selectedNodes[index].id &&
          node.type === this.selectedNodes[index].type,
      )
    )
      return;
    this.selectedNodes = nodes;
    this.focusedArgumentName = null;
    this.hoveredEntityId = null;
  }

  @action setSelectedEdges(ids: string[]) {
    if (
      ids.length === this.selectedEdgeIds.length &&
      ids.every((id, index) => id === this.selectedEdgeIds[index])
    )
      return;
    this.selectedEdgeIds = ids;
  }

  isNodeSelected(id: string): boolean {
    return this.selectedNodes.some((node) => node.id === id);
  }

  @action setHoveredEntity(id: string | null) {
    this.hoveredEntityId = id;
  }

  @action setPendingFocusNode(nodeId: string | null) {
    this.pendingFocusNodeId = nodeId;
  }

  /**
   * Asks the canvas to frame everything, for a change the user did not make
   * and cannot anticipate. A counter rather than a flag: consecutive requests
   * have to stay distinguishable, because the canvas coalesces them.
   */
  @action requestFitView() {
    this.fitViewRequestCount += 1;
  }

  @action setSelectedValidationIssue(issue: ValidationIssue | null) {
    this.selectedValidationIssue = issue;
  }

  /** True when this task is the sole selection or part of a canvas multi-selection. */
  isTaskSelected(taskId: string): boolean {
    return this.selectedNodes.some((n) => n.type === "task" && n.id === taskId);
  }
}
