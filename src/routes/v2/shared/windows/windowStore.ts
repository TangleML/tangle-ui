import { action, makeObservable, observable } from "mobx";
import type { ReactNode } from "react";

import { emitDockAreaEvent } from "./dockAreaPlugins";
import {
  CASCADE_OFFSET,
  DEFAULT_DOCK_AREA_WIDTH,
  DEFAULT_WINDOW_SIZE,
  type DockAreaConfig,
  type DockState,
  isDockSide,
  type Position,
  type Size,
  type WindowConfig,
  type WindowOptions,
  type WindowRef,
} from "./types";
import { getPersistedWindowState } from "./windowPersistence";
import * as docking from "./windowStore.docking";
import {
  buildWindowConfig,
  resolveInitialState,
  restoreWindowSnapshot,
  saveWindowSnapshot,
} from "./windowStore.helpers";

function generateWindowId(): string {
  return `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class WindowStoreImpl {
  /**
   * Content storage — kept as a plain (non-observable) Map to avoid
   * React Compiler issues. React elements must never be stored in an observable.
   */
  private contentMap = new Map<string, ReactNode>();
  @observable accessor windows: Record<string, WindowConfig> = {};
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

  /** Open a new window or focus existing window with same ID */
  @action openWindow(content: ReactNode, options: WindowOptions): WindowRef {
    const id = options.id ?? generateWindowId();

    const existingWindow = this.windows[id];
    if (existingWindow) {
      this.contentMap.set(id, content);
      this.bringToFront(id);
      if (
        existingWindow.state === "hidden" ||
        existingWindow.state === "minimized"
      ) {
        this.restoreWindow(id);
      }
      return this.createWindowRef(id);
    }

    this.contentMap.set(id, content);

    const persisted = options.persisted ? getPersistedWindowState(id) : null;

    const position =
      persisted?.position ?? options.position ?? this.calculateNewPosition();
    const dockState: DockState = persisted?.dockState ?? "none";
    const size = persisted?.size ?? options.size ?? { ...DEFAULT_WINDOW_SIZE };
    const initial = resolveInitialState(persisted, options, dockState);

    this.windows[id] = buildWindowConfig(
      id,
      options,
      persisted,
      position,
      size,
      dockState,
      initial,
    );
    this.windowOrder.push(id);

    if (dockState !== "none") {
      const dockArea = this.dockAreas[dockState];
      if (!dockArea.windowOrder.includes(id)) {
        dockArea.windowOrder.push(id);
      }
      emitDockAreaEvent({
        type: "window-docked",
        side: dockState,
        windowId: id,
      });
    }

    return this.createWindowRef(id);
  }

  /** Close a window (remove from registry) */
  @action closeWindow(id: string): void {
    const win = this.windows[id];
    if (win?.dockState && win.dockState !== "none") {
      emitDockAreaEvent({
        type: "window-closing",
        side: win.dockState,
        windowId: id,
      });
    }

    docking.removeFromDockAreaOrder(this.dockAreas, id);

    delete this.windows[id];
    this.contentMap.delete(id);
    const index = this.windowOrder.indexOf(id);
    if (index !== -1) {
      this.windowOrder.splice(index, 1);
    }
  }

  @action private minimizeWindow(id: string, { quiet = false } = {}): void {
    const win = this.windows[id];
    if (!win || win.state === "minimized") return;

    saveWindowSnapshot(win);
    win.state = "minimized";

    if (!quiet && win.dockState !== "none") {
      emitDockAreaEvent({
        type: "window-minimized",
        side: win.dockState,
        windowId: id,
      });
    }
  }

  @action private maximizeWindow(id: string): void {
    const win = this.windows[id];
    if (!win || win.state === "maximized") return;

    saveWindowSnapshot(win);
    win.state = "maximized";
    this.bringToFront(id);
  }

  /** Hide a window (move to task panel) */
  @action hideWindow(id: string): void {
    const win = this.windows[id];
    if (!win || win.state === "hidden") return;

    saveWindowSnapshot(win);
    win.state = "hidden";
  }

  /** Restore a window to its previous state */
  @action restoreWindow(id: string, { quiet = false } = {}): void {
    const win = this.windows[id];
    if (!win) return;

    const wasHidden = win.state === "hidden";
    const wasMinimized = win.state === "minimized";
    const wasDocked = win.dockState !== "none";

    restoreWindowSnapshot(win);

    if (!quiet) {
      this.bringToFront(id);
    }

    if (
      !quiet &&
      wasDocked &&
      (wasMinimized || wasHidden) &&
      isDockSide(win.dockState)
    ) {
      emitDockAreaEvent({
        type: "window-expanded",
        side: win.dockState,
        windowId: id,
      });
    }
  }

  /** Bring a window to the front (top of z-order) */
  @action bringToFront(id: string): void {
    const index = this.windowOrder.indexOf(id);
    if (index !== -1 && index !== this.windowOrder.length - 1) {
      this.windowOrder.splice(index, 1);
      this.windowOrder.push(id);
    }
  }

  /** Update window position */
  @action updateWindowPosition(id: string, position: Position): void {
    const win = this.windows[id];
    if (win) {
      win.position = position;
    }
  }

  /** Update window size */
  @action updateWindowSize(id: string, size: Size): void {
    const win = this.windows[id];
    if (win) {
      win.size = size;
    }
  }

  /** Get a window by ID */
  getWindowById(id: string): WindowConfig | undefined {
    return this.windows[id];
  }

  /** Get all windows as an array */
  getAllWindows(): WindowConfig[] {
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

  private createWindowRef(id: string): WindowRef {
    return {
      id,
      close: () => this.closeWindow(id),
      minimize: () => this.minimizeWindow(id),
      maximize: () => this.maximizeWindow(id),
      hide: () => this.hideWindow(id),
      restore: () => this.restoreWindow(id),
    };
  }

  /** Toggle window state - useful for minimize/maximize buttons */
  @action toggleMinimize(id: string): void {
    const win = this.windows[id];
    if (!win) return;

    if (win.state === "minimized") {
      this.restoreWindow(id);
    } else {
      this.minimizeWindow(id);
    }
  }

  @action toggleMaximize(id: string): void {
    const win = this.windows[id];
    if (!win) return;

    if (win.state === "maximized") {
      this.restoreWindow(id);
    } else {
      this.maximizeWindow(id);
    }
  }

  // -- Docking (delegates to windowStore.docking.ts) --

  @action dockWindow(id: string, side: DockState, insertIndex?: number): void {
    if (side !== "none" && !this.enabledDockSides.has(side)) return;
    docking.dockWindow(this.windows, this.dockAreas, id, side, insertIndex);
  }

  @action undockWindow(id: string): void {
    docking.undockWindow(this.windows, this.dockAreas, id);
  }

  isWindowDocked(id: string): boolean {
    return docking.isWindowDocked(this.windows, id);
  }

  @action updateDockedWindowHeight(id: string, height: number): void {
    docking.updateDockedWindowHeight(this.windows, id, height);
  }

  @action setDockAreaWidth(side: "left" | "right", width: number): void {
    docking.setDockAreaWidth(this.dockAreas, side, width);
  }

  @action toggleDockAreaCollapsed(side: "left" | "right"): void {
    docking.toggleDockAreaCollapsed(this.dockAreas, side);
  }

  @action enableDockSide(side: "left" | "right"): void {
    this.enabledDockSides = new Set([...this.enabledDockSides, side]);
  }

  @action disableDockSide(side: "left" | "right"): void {
    const next = new Set(this.enabledDockSides);
    next.delete(side);
    this.enabledDockSides = next;
  }

  isDockSideEnabled(side: "left" | "right"): boolean {
    return this.enabledDockSides.has(side);
  }

  getDockAreaWindowIds(side: "left" | "right"): string[] {
    return docking.getDockAreaWindowIds(this.dockAreas, side);
  }

  @action restoreDockArea(
    side: "left" | "right",
    state: { width: number; collapsed: boolean; windowOrder: string[] },
  ): void {
    docking.restoreDockArea(this.dockAreas, side, state);
  }

  /** Minimize without emitting dock area events. */
  @action minimizeWindowQuietly(id: string): void {
    this.minimizeWindow(id, { quiet: true });
  }

  /** Restore without emitting dock area events or cascading. */
  @action restoreWindowQuietly(id: string): void {
    this.restoreWindow(id, { quiet: true });
  }

  // -- Content --

  getWindowContent(id: string): ReactNode | undefined {
    return this.contentMap.get(id);
  }

  // -- Query helpers (promoted from windows.actions.ts) --

  getDockAreaConfig(side: "left" | "right"): DockAreaConfig {
    return this.dockAreas[side];
  }

  getHiddenWindows(): WindowConfig[] {
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
