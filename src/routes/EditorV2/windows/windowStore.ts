import { action, makeObservable, observable } from "mobx";
import type { ReactNode } from "react";

import { emitDockAreaEvent } from "./dockAreaPlugins";
import {
  calculateAttachPosition,
  getAttachmentChain,
  getWindowBottom,
} from "./snapUtils";
import {
  type AttachmentInfo,
  CASCADE_OFFSET,
  DEFAULT_DOCK_AREA_WIDTH,
  DEFAULT_DOCKED_HEIGHT,
  DEFAULT_MIN_SIZE,
  DEFAULT_WINDOW_SIZE,
  type DockAreaConfig,
  type DockState,
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

    let initialPosition =
      persistedState?.position ??
      options.position ??
      this.calculateNewPosition();
    let attachedTo: AttachmentInfo | undefined = persistedState?.attachedTo;
    const initialDockState: DockState = persistedState?.dockState ?? "none";
    const initialSize = persistedState?.size ??
      options.size ?? { ...DEFAULT_WINDOW_SIZE };

    if (!attachedTo && options.attachTo) {
      const parentWindow = this.windows[options.attachTo];
      if (parentWindow && parentWindow.state !== "hidden") {
        const windowSize = options.size ?? DEFAULT_WINDOW_SIZE;
        initialPosition = calculateAttachPosition(
          parentWindow,
          windowSize.width,
        );
        attachedTo = { parentId: options.attachTo, offsetX: 0 };
      }
    }

    const config: WindowConfig = {
      id,
      title: options.title,
      state: "normal",
      position: initialPosition,
      size: initialSize,
      minSize: options.minSize ?? { ...DEFAULT_MIN_SIZE },
      linkedEntityId: options.linkedEntityId,
      disabledActions: options.disabledActions,
      dockState: initialDockState,
      dockedHeight: persistedState?.dockedHeight,
      attachedTo,
      preDockedPosition: persistedState?.preDockedPosition
        ? { ...persistedState.preDockedPosition }
        : undefined,
      preDockedSize: persistedState?.preDockedSize
        ? { ...persistedState.preDockedSize }
        : undefined,
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

    if (persistedState?.isHidden && !options.startVisible) {
      setTimeout(() => this.hideWindow(id), 0);
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

    this.removeFromDockAreaOrder(id);

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

    this.cascadeOnHide(id);
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

    if (wasHidden) {
      this.cascadeOnRestore(id);
    }

    if (wasDocked && (wasMinimized || wasHidden)) {
      emitDockAreaEvent({
        type: "window-expanded",
        side: win.dockState as "left" | "right",
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
      const heightChanged = win.size.height !== size.height;
      win.size = size;

      if (heightChanged) {
        this.updateAttachedWindowPositions(id);
      }
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

  // ============================================================================
  // Docking Functions (Column-based Dock Areas)
  // ============================================================================

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

  /** Dock a window into a dock area column */
  @action dockWindow(id: string, side: DockState, insertIndex?: number): void {
    const win = this.windows[id];
    if (!win || side === "none") return;

    if (win.dockState === "none") {
      win.preDockedPosition = { ...win.position };
      win.preDockedSize = { ...win.size };
    }

    this.removeFromDockAreaOrder(id);

    if (win.attachedTo) {
      this.detachWindow(id);
    }

    win.dockState = side;
    win.dockedHeight = win.dockedHeight ?? DEFAULT_DOCKED_HEIGHT;

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

  /** Undock a window from its dock area, restoring pre-docked dimensions */
  @action undockWindow(id: string): void {
    const win = this.windows[id];
    if (!win || win.dockState === "none") return;

    this.removeFromDockAreaOrder(id);

    if (win.preDockedPosition) {
      win.position = { ...win.preDockedPosition };
    }
    if (win.preDockedSize) {
      win.size = { ...win.preDockedSize };
    }

    win.dockState = "none";
    win.preDockedPosition = undefined;
    win.preDockedSize = undefined;
  }

  /** Check if a window is docked */
  isWindowDocked(id: string): boolean {
    const win = this.windows[id];
    return win?.dockState !== "none" && win?.dockState !== undefined;
  }

  /** Update a docked window's height */
  @action updateDockedWindowHeight(id: string, height: number): void {
    const win = this.windows[id];
    if (!win) return;
    win.dockedHeight = Math.max(100, height);
  }

  /** Set dock area width */
  @action setDockAreaWidth(side: "left" | "right", width: number): void {
    this.dockAreas[side].width = width;
  }

  /** Toggle dock area collapsed state */
  @action toggleDockAreaCollapsed(side: "left" | "right"): void {
    this.dockAreas[side].collapsed = !this.dockAreas[side].collapsed;
  }

  /** Get all window IDs in a dock area */
  getDockAreaWindowIds(side: "left" | "right"): string[] {
    return this.dockAreas[side].windowOrder;
  }

  // ============================================================================
  // Attachment Functions
  // ============================================================================

  /** Attach a window below another window */
  @action attachWindow(childId: string, parentId: string): void {
    console.log("[windowStore] attachWindow called:", { childId, parentId });
    const childWindow = this.windows[childId];
    const parentWindow = this.windows[parentId];

    if (!childWindow || !parentWindow) {
      console.log(
        "[windowStore] attachWindow early return - childWindow:",
        !!childWindow,
        "parentWindow:",
        !!parentWindow,
      );
      return;
    }
    if (childId === parentId) {
      console.log("[windowStore] attachWindow early return - same window");
      return;
    }

    if (parentWindow.state === "hidden" || parentWindow.state === "minimized") {
      console.log(
        "[windowStore] attachWindow early return - parent state:",
        parentWindow.state,
      );
      return;
    }

    const attachPosition = {
      x: parentWindow.position.x,
      y: getWindowBottom(parentWindow),
    };
    console.log(
      "[windowStore] attachWindow calculated position:",
      attachPosition,
    );

    childWindow.attachedTo = { parentId, offsetX: 0 };
    childWindow.position = attachPosition;

    if (childWindow.dockState !== "none") {
      childWindow.dockState = "none";
    }

    console.log("[windowStore] attachWindow complete - child state:", {
      position: childWindow.position,
      attachedTo: childWindow.attachedTo,
    });
  }

  /** Detach a window from its parent */
  @action detachWindow(id: string): void {
    const win = this.windows[id];
    if (!win?.attachedTo) return;
    win.attachedTo = undefined;
  }

  private findChainRoot(windowId: string): string {
    let currentId = windowId;
    let current = this.windows[currentId];

    while (current?.attachedTo?.parentId) {
      const parent = this.windows[current.attachedTo.parentId];
      if (!parent) break;
      currentId = parent.id;
      current = parent;
    }

    return currentId;
  }

  private findVisibleAncestor(windowId: string): WindowConfig | null {
    const win = this.windows[windowId];
    if (!win?.attachedTo?.parentId) return null;

    let currentParentId: string | undefined = win.attachedTo.parentId;

    while (currentParentId) {
      const parentWin: WindowConfig | undefined = this.windows[currentParentId];
      if (!parentWin) return null;

      if (parentWin.state !== "hidden") {
        return parentWin;
      }

      currentParentId = parentWin.attachedTo?.parentId;
    }

    return null;
  }

  @action private updateAttachedWindowPositions(rootId: string): void {
    const rootWindow = this.windows[rootId];
    if (!rootWindow) return;

    const chain = getAttachmentChain(rootId, Object.values(this.windows));

    const rootX =
      rootWindow.state === "hidden"
        ? (rootWindow.previousPosition?.x ?? rootWindow.position.x)
        : rootWindow.position.x;

    for (const child of chain) {
      if (child.state === "hidden") continue;

      const visibleAncestor = this.findVisibleAncestor(child.id);

      if (visibleAncestor) {
        child.position = {
          x: rootX,
          y: getWindowBottom(visibleAncestor),
        };
      } else if (rootWindow.state !== "hidden") {
        child.position = {
          x: rootX,
          y: getWindowBottom(rootWindow),
        };
      } else {
        const rootY = rootWindow.previousPosition?.y ?? rootWindow.position.y;
        child.position = { x: rootX, y: rootY };
      }
    }
  }

  private cascadeOnHide(hiddenWindowId: string): void {
    const rootId = this.findChainRoot(hiddenWindowId);
    this.updateAttachedWindowPositions(rootId);
  }

  private cascadeOnRestore(restoredWindowId: string): void {
    const rootId = this.findChainRoot(restoredWindowId);
    this.updateAttachedWindowPositions(rootId);
  }
}

export const windowStore = new WindowStoreImpl();

// Re-export thin wrappers for backward compatibility with existing call sites

export function openWindow(
  content: ReactNode,
  options: WindowOptions,
): WindowRef {
  return windowStore.openWindow(content, options);
}

export function closeWindow(id: string): void {
  windowStore.closeWindow(id);
}

export function hideWindow(id: string): void {
  windowStore.hideWindow(id);
}

export function restoreWindow(id: string): void {
  windowStore.restoreWindow(id);
}

export function bringToFront(id: string): void {
  windowStore.bringToFront(id);
}

export function updateWindowPosition(id: string, position: Position): void {
  windowStore.updateWindowPosition(id, position);
}

export function updateWindowSize(id: string, size: Size): void {
  windowStore.updateWindowSize(id, size);
}

export function getWindowById(id: string): WindowConfig | undefined {
  return windowStore.getWindowById(id);
}

export function getAllWindows(): WindowConfig[] {
  return windowStore.getAllWindows();
}

export function closeWindowsByLinkedEntity(entityId: string): void {
  windowStore.closeWindowsByLinkedEntity(entityId);
}

export function toggleMinimize(id: string): void {
  windowStore.toggleMinimize(id);
}

export function toggleMaximize(id: string): void {
  windowStore.toggleMaximize(id);
}

export function dockWindow(
  id: string,
  side: DockState,
  insertIndex?: number,
): void {
  windowStore.dockWindow(id, side, insertIndex);
}

export function undockWindow(id: string): void {
  windowStore.undockWindow(id);
}

export function isWindowDocked(id: string): boolean {
  return windowStore.isWindowDocked(id);
}

export function updateDockedWindowHeight(id: string, height: number): void {
  windowStore.updateDockedWindowHeight(id, height);
}

export function setDockAreaWidth(side: "left" | "right", width: number): void {
  windowStore.setDockAreaWidth(side, width);
}

export function toggleDockAreaCollapsed(side: "left" | "right"): void {
  windowStore.toggleDockAreaCollapsed(side);
}

export function getDockAreaWindowIds(side: "left" | "right"): string[] {
  return windowStore.getDockAreaWindowIds(side);
}

export function attachWindow(childId: string, parentId: string): void {
  windowStore.attachWindow(childId, parentId);
}

export function detachWindow(id: string): void {
  windowStore.detachWindow(id);
}
