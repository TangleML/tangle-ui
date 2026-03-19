import { action, makeObservable, observable } from "mobx";
import type { ReactNode } from "react";

import { emitDockAreaEvent } from "./dockAreaPlugins";
import {
  CASCADE_OFFSET,
  DEFAULT_DOCK_AREA_WIDTH,
  DEFAULT_MIN_SIZE,
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
import {
  getPersistedWindowState,
  STATIC_WINDOW_IDS,
} from "./windowPersistence";
import {
  dockWindow as dockWindowFn,
  getDockAreaWindowIds as getDockAreaWindowIdsFn,
  isWindowDocked as isWindowDockedFn,
  removeFromDockAreaOrder,
  restoreDockArea as restoreDockAreaFn,
  setDockAreaWidth as setDockAreaWidthFn,
  toggleDockAreaCollapsed as toggleDockAreaCollapsedFn,
  undockWindow as undockWindowFn,
  updateDockedWindowHeight as updateDockedWindowHeightFn,
} from "./windowStore.docking";

/**
 * Content storage - separate from observable store to avoid React Compiler issues.
 * React elements should never be stored in an observable.
 */
const windowContentMap = new Map<string, ReactNode>();

/** Get window content by ID */
export function getWindowContent(id: string): ReactNode | undefined {
  return windowContentMap.get(id);
}

function generateWindowId(): string {
  return `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

class WindowStoreImpl {
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
      windowContentMap.set(id, content);
      this.bringToFront(id);
      if (
        existingWindow.state === "hidden" ||
        existingWindow.state === "minimized"
      ) {
        this.restoreWindow(id);
      }
      return this.createWindowRef(id);
    }

    windowContentMap.set(id, content);

    const persistedState = STATIC_WINDOW_IDS.has(id)
      ? getPersistedWindowState(id)
      : null;

    const initialPosition =
      persistedState?.position ??
      options.position ??
      this.calculateNewPosition();
    const initialDockState: DockState = persistedState?.dockState ?? "none";
    const initialSize = persistedState?.size ??
      options.size ?? { ...DEFAULT_WINDOW_SIZE };

    const shouldStartHidden =
      !!persistedState?.isHidden && !options.startVisible;
    const shouldStartMinimized =
      !shouldStartHidden &&
      !!persistedState?.isMinimized &&
      initialDockState !== "none";
    const needsPreviousState = shouldStartHidden || shouldStartMinimized;

    const config: WindowConfig = {
      id,
      title: options.title,
      state: shouldStartHidden
        ? "hidden"
        : shouldStartMinimized
          ? "minimized"
          : "normal",
      position: initialPosition,
      size: initialSize,
      minSize: options.minSize ?? { ...DEFAULT_MIN_SIZE },
      linkedEntityId: options.linkedEntityId,
      disabledActions: options.disabledActions,
      dockState: initialDockState,
      dockedHeight: persistedState?.dockedHeight,
      preDockedPosition: persistedState?.preDockedPosition
        ? { ...persistedState.preDockedPosition }
        : undefined,
      preDockedSize: persistedState?.preDockedSize
        ? { ...persistedState.preDockedSize }
        : undefined,
      previousState: needsPreviousState ? "normal" : undefined,
      previousPosition: needsPreviousState ? { ...initialPosition } : undefined,
      previousSize: needsPreviousState ? { ...initialSize } : undefined,
    };

    this.windows[id] = config;
    this.windowOrder.push(id);

    if (initialDockState !== "none") {
      const dockArea = this.dockAreas[initialDockState];
      if (!dockArea.windowOrder.includes(id)) {
        dockArea.windowOrder.push(id);
      }
      emitDockAreaEvent({
        type: "window-docked",
        side: initialDockState,
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

    removeFromDockAreaOrder(this.dockAreas, id);

    delete this.windows[id];
    windowContentMap.delete(id);
    const index = this.windowOrder.indexOf(id);
    if (index !== -1) {
      this.windowOrder.splice(index, 1);
    }
  }

  @action private minimizeWindow(id: string): void {
    const win = this.windows[id];
    if (!win || win.state === "minimized") return;

    win.previousState = win.state;
    win.previousPosition = { ...win.position };
    win.previousSize = { ...win.size };
    win.state = "minimized";

    if (win.dockState !== "none") {
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

    win.previousState = win.state;
    win.previousPosition = { ...win.position };
    win.previousSize = { ...win.size };
    win.state = "maximized";
    this.bringToFront(id);
  }

  /** Hide a window (move to task panel) */
  @action hideWindow(id: string): void {
    const win = this.windows[id];
    if (!win || win.state === "hidden") return;

    win.previousState = win.state;
    win.previousPosition = { ...win.position };
    win.previousSize = { ...win.size };
    win.state = "hidden";
  }

  /** Restore a window to its previous state */
  @action restoreWindow(id: string): void {
    const win = this.windows[id];
    if (!win) return;

    const wasHidden = win.state === "hidden";
    const wasMinimized = win.state === "minimized";
    const wasDocked = win.dockState !== "none";

    const targetState = win.previousState ?? "normal";

    if (win.previousPosition) {
      win.position = { ...win.previousPosition };
    }
    if (win.previousSize) {
      win.size = { ...win.previousSize };
    }

    win.state = targetState === "maximized" ? "normal" : targetState;

    win.previousState = undefined;
    win.previousPosition = undefined;
    win.previousSize = undefined;

    this.bringToFront(id);

    if (wasDocked && (wasMinimized || wasHidden) && isDockSide(win.dockState)) {
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
    dockWindowFn(this.windows, this.dockAreas, id, side, insertIndex);
  }

  @action undockWindow(id: string): void {
    undockWindowFn(this.windows, this.dockAreas, id);
  }

  isWindowDocked(id: string): boolean {
    return isWindowDockedFn(this.windows, id);
  }

  @action updateDockedWindowHeight(id: string, height: number): void {
    updateDockedWindowHeightFn(this.windows, id, height);
  }

  @action setDockAreaWidth(side: "left" | "right", width: number): void {
    setDockAreaWidthFn(this.dockAreas, side, width);
  }

  @action toggleDockAreaCollapsed(side: "left" | "right"): void {
    toggleDockAreaCollapsedFn(this.dockAreas, side);
  }

  getDockAreaWindowIds(side: "left" | "right"): string[] {
    return getDockAreaWindowIdsFn(this.dockAreas, side);
  }

  @action restoreDockArea(
    side: "left" | "right",
    state: { width: number; collapsed: boolean; windowOrder: string[] },
  ): void {
    restoreDockAreaFn(this.dockAreas, side, state);
  }

  // -- Quiet mutations (no event emission — used by accordion plugin) --

  /** Minimize without emitting dock area events. */
  @action minimizeWindowQuietly(id: string): void {
    const win = this.windows[id];
    if (!win || win.state === "minimized") return;
    win.previousState = win.state;
    win.previousPosition = { ...win.position };
    win.previousSize = { ...win.size };
    win.state = "minimized";
  }

  /** Restore from minimized without emitting dock area events or cascading. */
  @action restoreWindowQuietly(id: string): void {
    const win = this.windows[id];
    if (!win || win.state !== "minimized") return;
    win.state =
      win.previousState === "maximized"
        ? "normal"
        : (win.previousState ?? "normal");
    if (win.previousPosition) win.position = { ...win.previousPosition };
    if (win.previousSize) win.size = { ...win.previousSize };
    win.previousState = undefined;
    win.previousPosition = undefined;
    win.previousSize = undefined;
  }
}

export const windowStore = new WindowStoreImpl();
