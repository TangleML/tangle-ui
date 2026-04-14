import { action, makeObservable, observable } from "mobx";
import type { ReactNode } from "react";

import { emitDockAreaEvent } from "./dockAreaPlugins";
import {
  CASCADE_OFFSET,
  DEFAULT_DOCK_AREA_WIDTH,
  type DockAreaConfig,
  type DockState,
  isDockSide,
  type Position,
  type WindowOptions,
  type WindowRef,
} from "./types";
import type { ViewPreset } from "./viewPresets";
import { WindowModel, type WindowStoreRef } from "./windowModel";
import { buildWindowModelInit } from "./windowStore.utils";

function generateWindowId(): string {
  return `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class WindowStoreImpl implements WindowStoreRef {
  /**
   * Content storage — kept as a plain (non-observable) Map to avoid
   * React Compiler issues. React elements must never be stored in an observable.
   */
  private contentMap = new Map<string, ReactNode>();
  @observable.shallow accessor windows: Record<string, WindowModel> = {};
  @observable.shallow accessor windowOrder: string[] = [];
  @observable accessor dockAreas: {
    left: DockAreaConfig;
    right: DockAreaConfig;
  } = {
    left: {
      width: DEFAULT_DOCK_AREA_WIDTH,
      collapsed: false,
      windowOrder: [],
    },
    right: {
      width: DEFAULT_DOCK_AREA_WIDTH,
      collapsed: false,
      windowOrder: [],
    },
  };
  @observable accessor enabledDockSides: Set<"left" | "right"> = new Set();

  constructor() {
    makeObservable(this);
  }

  private calculateNewPosition(): Position {
    const windowCount = this.windowOrder.length;
    return {
      x: 100 + windowCount * CASCADE_OFFSET,
      y: 100 + windowCount * CASCADE_OFFSET,
    };
  }

  private focusExistingWindow(
    id: string,
    content: ReactNode,
    existing: WindowModel,
  ): WindowRef {
    this.contentMap.set(id, content);
    this.bringToFront(id);
    if (existing.state === "hidden" || existing.isMinimized) {
      existing.restore();
    }
    return this.createWindowRef(existing);
  }

  private registerNewWindowInDockArea(id: string, dockState: DockState): void {
    if (dockState === "none") return;
    const dockArea = this.dockAreas[dockState];
    if (!dockArea.windowOrder.includes(id)) {
      dockArea.windowOrder.push(id);
    }
    emitDockAreaEvent({ type: "window-docked", side: dockState, windowId: id });
  }

  /** Open a new window or focus existing window with same ID */
  @action openWindow(content: ReactNode, options: WindowOptions): WindowRef {
    const id = options.id ?? generateWindowId();

    const existing = this.windows[id];
    if (existing) {
      return this.focusExistingWindow(id, content, existing);
    }

    this.contentMap.set(id, content);
    const init = buildWindowModelInit(id, options, this.calculateNewPosition());
    const model = new WindowModel(init, this);

    this.windows[id] = model;
    this.windowOrder.push(id);
    this.registerNewWindowInDockArea(id, init.dockState);

    return this.createWindowRef(model);
  }

  /** Close a window (remove from registry) */
  @action closeWindow(id: string): void {
    const win = this.windows[id];
    if (!win) return;

    if (win.isDocked && isDockSide(win.dockState)) {
      emitDockAreaEvent({
        type: "window-closing",
        side: win.dockState,
        windowId: id,
      });
    }

    this.removeFromDockAreaOrder(id);
    delete this.windows[id];
    this.contentMap.delete(id);

    const index = this.windowOrder.indexOf(id);
    if (index !== -1) {
      this.windowOrder.splice(index, 1);
    }

    win.onClose?.();
  }

  /** Bring a window to the front (top of z-order) */
  @action bringToFront(id: string): void {
    const index = this.windowOrder.indexOf(id);
    if (index !== -1 && index !== this.windowOrder.length - 1) {
      this.windowOrder.splice(index, 1);
      this.windowOrder.push(id);
    }
  }

  /** Hide a window (move to task panel). Convenience delegation to WindowModel. */
  hideWindow(id: string): void {
    this.windows[id]?.hide();
  }

  /** Restore a window to its previous state. Convenience delegation to WindowModel. */
  restoreWindow(id: string): void {
    this.windows[id]?.restore();
  }

  /** Get a window model by ID */
  getWindowById(id: string): WindowModel | undefined {
    return this.windows[id];
  }

  /** Get all windows as an array */
  getAllWindows(): WindowModel[] {
    return this.windowOrder.map((id) => this.windows[id]);
  }

  /** Close all windows linked to a specific entity */
  @action closeWindowsByLinkedEntity(entityId: string): void {
    const windowsToClose = this.windowOrder.filter(
      (id) => this.windows[id]?.linkedEntityId === entityId,
    );
    for (const id of windowsToClose) {
      this.closeWindow(id);
    }
  }

  private createWindowRef(model: WindowModel): WindowRef {
    return {
      id: model.id,
      close: () => model.close(),
      minimize: () => model.minimize(),
      maximize: () => model.maximize(),
      hide: () => model.hide(),
      restore: () => model.restore(),
    };
  }

  // -- Docking --

  @action dockWindow(id: string, side: DockState, insertIndex?: number): void {
    if (side === "none" || !this.enabledDockSides.has(side)) return;
    const win = this.windows[id];
    if (!win) return;

    win.savePreDockedState();
    this.removeFromDockAreaOrder(id);
    win.applyDockState(side);

    const dockArea = this.dockAreas[side];
    if (insertIndex !== undefined && insertIndex >= 0) {
      const clampedIndex = Math.min(insertIndex, dockArea.windowOrder.length);
      dockArea.windowOrder.splice(clampedIndex, 0, id);
    } else {
      dockArea.windowOrder.push(id);
    }
    dockArea.collapsed = false;

    emitDockAreaEvent({ type: "window-docked", side, windowId: id });
  }

  @action undockWindow(id: string): void {
    const win = this.windows[id];
    if (!win || win.dockState === "none") return;

    this.removeFromDockAreaOrder(id);
    win.applyUndockState();
  }

  @action private removeFromDockAreaOrder(id: string): void {
    for (const side of ["left", "right"] as const) {
      const order = this.dockAreas[side].windowOrder;
      const idx = order.indexOf(id);
      if (idx !== -1) {
        order.splice(idx, 1);
        return;
      }
    }
  }

  @action setDockAreaWidth(side: "left" | "right", width: number): void {
    this.dockAreas[side].width = width;
  }

  @action toggleDockAreaCollapsed(side: "left" | "right"): void {
    this.dockAreas[side].collapsed = !this.dockAreas[side].collapsed;
  }

  @action enableDockSide(side: "left" | "right"): void {
    this.enabledDockSides = new Set([...this.enabledDockSides, side]);
  }

  @action disableDockSide(side: "left" | "right"): void {
    const next = new Set(this.enabledDockSides);
    next.delete(side);
    this.enabledDockSides = next;
  }

  @action restoreDockArea(
    side: "left" | "right",
    state: { width: number; collapsed: boolean; windowOrder: string[] },
  ): void {
    this.dockAreas[side].width = state.width;
    this.dockAreas[side].collapsed = state.collapsed;
    this.dockAreas[side].windowOrder = [...state.windowOrder];
  }

  isDockSideEnabled(side: "left" | "right"): boolean {
    return this.enabledDockSides.has(side);
  }

  getDockAreaWindowIds(side: "left" | "right"): string[] {
    return this.dockAreas[side].windowOrder;
  }

  // -- View presets --

  /** Apply a view preset: toggle visibility and reset dock positions. */
  @action applyViewPreset(preset: ViewPreset): void {
    const allWindows = this.getAllWindows();
    for (const win of allWindows) {
      if (preset.visible.has(win.id)) {
        if (win.state === "hidden") win.restore();
      } else {
        if (win.state !== "hidden") win.hide();
      }
    }
    if (preset.dockPositions) {
      for (const [id, side] of Object.entries(preset.dockPositions)) {
        const win = this.windows[id];
        if (win && win.dockState !== side) {
          this.undockWindow(id);
          this.dockWindow(id, side);
        }
      }
    }
  }

  // -- Content --

  getWindowContent(id: string): ReactNode | undefined {
    return this.contentMap.get(id);
  }

  // -- Query helpers --

  getDockAreaConfig(side: "left" | "right"): DockAreaConfig {
    return this.dockAreas[side];
  }

  getHiddenWindows(): WindowModel[] {
    return this.windowOrder
      .map((id) => this.windows[id])
      .filter((w) => w?.state === "hidden");
  }

  getWindowZIndex(id: string): number {
    return this.windowOrder.indexOf(id);
  }

  isWindowAtFront(id: string): boolean {
    const idx = this.windowOrder.indexOf(id);
    return idx === this.windowOrder.length - 1;
  }

  get windowOrderLength(): number {
    return this.windowOrder.length;
  }

  get hasHiddenWindows(): boolean {
    return this.windowOrder.some((id) => this.windows[id]?.state === "hidden");
  }

  isDockAreaCollapsed(side: DockState): boolean {
    if (side === "none") return false;
    return this.dockAreas[side].collapsed;
  }

  getFloatingWindowIds(): string[] {
    return this.windowOrder.filter(
      (id) => this.windows[id]?.dockState === "none",
    );
  }

  get currentWindowOrder(): string[] {
    return this.windowOrder;
  }

  getDockAreaWidth(side: "left" | "right"): number {
    return this.dockAreas[side].width;
  }

  isWindowPersisted(id: string): boolean {
    return this.windows[id]?.persisted === true;
  }

  getPersistedWindowIds(): string[] {
    return this.windowOrder.filter((id) => this.windows[id]?.persisted);
  }

  /** Deep-serialize all store state for MobX change tracking. */
  getSerializedStoreState(): string {
    return JSON.stringify({
      w: this.windows,
      o: this.windowOrder,
      d: this.dockAreas,
    });
  }
}
