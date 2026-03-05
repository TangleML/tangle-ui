import type { ReactNode } from "react";
import { proxy } from "valtio";

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

interface WindowStore {
  /** Map of window ID to window configuration */
  windows: Record<string, WindowConfig>;
  /** Ordered list of window IDs for z-index stacking (last = top) */
  windowOrder: string[];
  /** Dock area configurations for left and right columns */
  dockAreas: {
    left: DockAreaConfig;
    right: DockAreaConfig;
  };
}

export const windowStore = proxy<WindowStore>({
  windows: {},
  windowOrder: [],
  dockAreas: {
    left: { width: DEFAULT_DOCK_AREA_WIDTH, collapsed: false, windowOrder: [] },
    right: {
      width: DEFAULT_DOCK_AREA_WIDTH,
      collapsed: false,
      windowOrder: [],
    },
  },
});

/**
 * Content storage - separate from Valtio proxy to avoid React Compiler issues.
 * React elements should never be stored in a proxy.
 */
const windowContentMap = new Map<string, ReactNode>();

/** Get window content by ID */
export function getWindowContent(id: string): ReactNode | undefined {
  return windowContentMap.get(id);
}

/** Generate a unique window ID */
function generateWindowId(): string {
  return `window-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Calculate position for a new window (cascading from last window) */
function calculateNewPosition(): Position {
  const windowCount = windowStore.windowOrder.length;
  const baseX = 100;
  const baseY = 100;

  return {
    x: baseX + windowCount * CASCADE_OFFSET,
    y: baseY + windowCount * CASCADE_OFFSET,
  };
}

/** Open a new window or focus existing window with same ID */
export function openWindow(
  content: ReactNode,
  options: WindowOptions,
): WindowRef {
  const id = options.id ?? generateWindowId();

  // If window with this ID already exists, bring it to front and restore
  const existingWindow = windowStore.windows[id];
  if (existingWindow) {
    // Update content
    windowContentMap.set(id, content);
    bringToFront(id);
    if (
      existingWindow.state === "hidden" ||
      existingWindow.state === "minimized"
    ) {
      restoreWindow(id);
    }
    return createWindowRef(id);
  }

  // Store content separately (not in proxy)
  windowContentMap.set(id, content);

  // Check for persisted state (only for static windows)
  const persistedState = STATIC_WINDOW_IDS.has(id)
    ? getPersistedWindowState(id)
    : null;

  // Calculate initial position and attachment
  let initialPosition =
    persistedState?.position ?? options.position ?? calculateNewPosition();
  let attachedTo: AttachmentInfo | undefined = persistedState?.attachedTo;
  const initialDockState: DockState = persistedState?.dockState ?? "none";
  const initialSize = persistedState?.size ??
    options.size ?? { ...DEFAULT_WINDOW_SIZE };

  // Handle attachment to parent window (only if no persisted attachment)
  if (!attachedTo && options.attachTo) {
    const parentWindow = windowStore.windows[options.attachTo];
    if (parentWindow && parentWindow.state !== "hidden") {
      const windowSize = options.size ?? DEFAULT_WINDOW_SIZE;
      initialPosition = calculateAttachPosition(parentWindow, windowSize.width);
      attachedTo = {
        parentId: options.attachTo,
        offsetX: 0, // Aligned to parent's left edge
      };
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
    // Restore pre-docked dimensions from persisted state (needed for undock)
    preDockedPosition: persistedState?.preDockedPosition
      ? { ...persistedState.preDockedPosition }
      : undefined,
    preDockedSize: persistedState?.preDockedSize
      ? { ...persistedState.preDockedSize }
      : undefined,
  };

  windowStore.windows[id] = config;
  windowStore.windowOrder.push(id);

  // If the window is docked, ensure it's in the dock area order
  if (initialDockState !== "none") {
    const dockArea = windowStore.dockAreas[initialDockState];
    if (!dockArea.windowOrder.includes(id)) {
      dockArea.windowOrder.push(id);
    }
  }

  // Apply hidden state after window creation if persisted as hidden
  // Skip if startVisible is true (for selection-driven windows like context-panel)
  if (persistedState?.isHidden && !options.startVisible) {
    setTimeout(() => hideWindow(id), 0);
  }

  return createWindowRef(id);
}

/** Close a window (remove from registry) */
export function closeWindow(id: string): void {
  // Remove from dock area order if docked
  removeFromDockAreaOrder(id);

  delete windowStore.windows[id];
  windowContentMap.delete(id);
  const index = windowStore.windowOrder.indexOf(id);
  if (index !== -1) {
    windowStore.windowOrder.splice(index, 1);
  }
}

/** Minimize a window (collapse to header only) */
function minimizeWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window || window.state === "minimized") return;

  window.previousState = window.state;
  window.previousPosition = { ...window.position };
  window.previousSize = { ...window.size };
  window.state = "minimized";
}

/** Maximize a window (full screen) */
function maximizeWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window || window.state === "maximized") return;

  window.previousState = window.state;
  window.previousPosition = { ...window.position };
  window.previousSize = { ...window.size };
  window.state = "maximized";
  bringToFront(id);
}

/** Hide a window (move to task panel) */
export function hideWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window || window.state === "hidden") return;

  window.previousState = window.state;
  window.previousPosition = { ...window.position };
  window.previousSize = { ...window.size };
  window.state = "hidden";

  // Cascade attached windows up to take the hidden window's place
  cascadeOnHide(id);
}

/** Restore a window to its previous state */
export function restoreWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window) return;

  const wasHidden = window.state === "hidden";

  // Restore to normal if no previous state or if coming from hidden/minimized
  const targetState = window.previousState ?? "normal";

  if (window.previousPosition) {
    window.position = { ...window.previousPosition };
  }
  if (window.previousSize) {
    window.size = { ...window.previousSize };
  }

  // If restoring from maximized, go to normal
  // If restoring from hidden/minimized, go to previous state (or normal)
  window.state = targetState === "maximized" ? "normal" : targetState;

  // Clear previous state after restore
  window.previousState = undefined;
  window.previousPosition = undefined;
  window.previousSize = undefined;

  bringToFront(id);

  // Push attached windows down when restoring from hidden
  if (wasHidden) {
    cascadeOnRestore(id);
  }
}

/** Bring a window to the front (top of z-order) */
export function bringToFront(id: string): void {
  const index = windowStore.windowOrder.indexOf(id);
  if (index !== -1 && index !== windowStore.windowOrder.length - 1) {
    windowStore.windowOrder.splice(index, 1);
    windowStore.windowOrder.push(id);
  }
}

/** Update window position */
export function updateWindowPosition(id: string, position: Position): void {
  const window = windowStore.windows[id];
  if (window) {
    window.position = position;
  }
}

/** Update window size */
export function updateWindowSize(id: string, size: Size): void {
  const window = windowStore.windows[id];
  if (window) {
    const heightChanged = window.size.height !== size.height;
    window.size = size;

    // If height changed, update attached windows positions
    if (heightChanged) {
      updateAttachedWindowPositions(id);
    }
  }
}

/** Get a window by ID */
export function getWindowById(id: string): WindowConfig | undefined {
  return windowStore.windows[id];
}

/** Get all windows as an array */
export function getAllWindows(): WindowConfig[] {
  return windowStore.windowOrder.map((id) => windowStore.windows[id]);
}

/** Close all windows linked to a specific entity */
export function closeWindowsByLinkedEntity(entityId: string): void {
  const windowsToClose = windowStore.windowOrder.filter(
    (id) => windowStore.windows[id]?.linkedEntityId === entityId,
  );
  for (const id of windowsToClose) {
    closeWindow(id);
  }
}

/** Create a WindowRef object for external control */
function createWindowRef(id: string): WindowRef {
  return {
    id,
    close: () => closeWindow(id),
    minimize: () => minimizeWindow(id),
    maximize: () => maximizeWindow(id),
    hide: () => hideWindow(id),
    restore: () => restoreWindow(id),
  };
}

/** Toggle window state - useful for minimize/maximize buttons */
export function toggleMinimize(id: string): void {
  const window = windowStore.windows[id];
  if (!window) return;

  if (window.state === "minimized") {
    restoreWindow(id);
  } else {
    minimizeWindow(id);
  }
}

export function toggleMaximize(id: string): void {
  const window = windowStore.windows[id];
  if (!window) return;

  if (window.state === "maximized") {
    restoreWindow(id);
  } else {
    maximizeWindow(id);
  }
}

// ============================================================================
// Docking Functions (Column-based Dock Areas)
// ============================================================================

/** Remove a window from whichever dock area order it's in */
function removeFromDockAreaOrder(id: string): void {
  for (const side of ["left", "right"] as const) {
    const order = windowStore.dockAreas[side].windowOrder;
    const idx = order.indexOf(id);
    if (idx !== -1) {
      order.splice(idx, 1);
      return;
    }
  }
}

/** Dock a window into a dock area column */
export function dockWindow(
  id: string,
  side: DockState,
  insertIndex?: number,
): void {
  const win = windowStore.windows[id];
  if (!win || side === "none") return;

  // Store pre-docked state for undocking
  if (win.dockState === "none") {
    win.preDockedPosition = { ...win.position };
    win.preDockedSize = { ...win.size };
  }

  // Remove from any previous dock area
  removeFromDockAreaOrder(id);

  // Detach from any parent when docking
  if (win.attachedTo) {
    detachWindow(id);
  }

  // Set docked state
  win.dockState = side;
  win.dockedHeight = win.dockedHeight ?? DEFAULT_DOCKED_HEIGHT;

  // Insert into dock area order
  const dockArea = windowStore.dockAreas[side];
  if (insertIndex !== undefined && insertIndex >= 0) {
    const clampedIndex = Math.min(insertIndex, dockArea.windowOrder.length);
    dockArea.windowOrder.splice(clampedIndex, 0, id);
  } else {
    dockArea.windowOrder.push(id);
  }

  // Un-collapse the dock area when a window is added
  dockArea.collapsed = false;
}

/** Undock a window from its dock area, restoring pre-docked dimensions */
export function undockWindow(id: string): void {
  const win = windowStore.windows[id];
  if (!win || win.dockState === "none") return;

  // Remove from dock area order
  removeFromDockAreaOrder(id);

  // Restore pre-docked dimensions
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
export function isWindowDocked(id: string): boolean {
  const win = windowStore.windows[id];
  return win?.dockState !== "none" && win?.dockState !== undefined;
}

/** Reorder a docked window within its dock area */
export function reorderDockedWindow(
  id: string,
  side: "left" | "right",
  newIndex: number,
): void {
  const order = windowStore.dockAreas[side].windowOrder;
  const currentIndex = order.indexOf(id);
  if (currentIndex === -1) return;

  order.splice(currentIndex, 1);
  const clampedIndex = Math.min(newIndex, order.length);
  order.splice(clampedIndex, 0, id);
}

/** Update a docked window's height */
export function updateDockedWindowHeight(id: string, height: number): void {
  const win = windowStore.windows[id];
  if (!win) return;
  win.dockedHeight = Math.max(100, height);
}

/** Set dock area width */
export function setDockAreaWidth(side: "left" | "right", width: number): void {
  windowStore.dockAreas[side].width = width;
}

/** Toggle dock area collapsed state */
export function toggleDockAreaCollapsed(side: "left" | "right"): void {
  windowStore.dockAreas[side].collapsed =
    !windowStore.dockAreas[side].collapsed;
}

/** Get all window IDs in a dock area */
export function getDockAreaWindowIds(side: "left" | "right"): string[] {
  return windowStore.dockAreas[side].windowOrder;
}

// ============================================================================
// Attachment Functions
// ============================================================================

/** Attach a window below another window */
export function attachWindow(childId: string, parentId: string): void {
  console.log("[windowStore] attachWindow called:", { childId, parentId });
  const childWindow = windowStore.windows[childId];
  const parentWindow = windowStore.windows[parentId];

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

  // Don't attach if parent is hidden or minimized
  if (parentWindow.state === "hidden" || parentWindow.state === "minimized") {
    console.log(
      "[windowStore] attachWindow early return - parent state:",
      parentWindow.state,
    );
    return;
  }

  // Calculate attached position - align left edges and place at parent's bottom
  const attachPosition = {
    x: parentWindow.position.x, // Align left edges
    y: getWindowBottom(parentWindow), // Place at parent's bottom
  };
  console.log(
    "[windowStore] attachWindow calculated position:",
    attachPosition,
  );

  childWindow.attachedTo = {
    parentId,
    offsetX: 0, // Always align left edges
  };

  // Align to parent
  childWindow.position = attachPosition;

  // Undock if docked when attaching
  if (childWindow.dockState !== "none") {
    childWindow.dockState = "none";
  }

  console.log("[windowStore] attachWindow complete - child state:", {
    position: childWindow.position,
    attachedTo: childWindow.attachedTo,
  });
}

/** Detach a window from its parent */
export function detachWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window?.attachedTo) return;

  window.attachedTo = undefined;
}

/**
 * Find the root window of an attachment chain (the topmost visible parent).
 * Walks up the chain until finding a window with no parent or a hidden parent.
 */
function findChainRoot(windowId: string): string {
  let currentId = windowId;
  let current = windowStore.windows[currentId];

  while (current?.attachedTo?.parentId) {
    const parent = windowStore.windows[current.attachedTo.parentId];
    if (!parent) break;
    currentId = parent.id;
    current = parent;
  }

  return currentId;
}

/**
 * Find the nearest visible ancestor of a window (skipping hidden windows).
 * Returns null if no visible ancestor exists (window is at root level).
 */
function findVisibleAncestor(windowId: string): WindowConfig | null {
  const win = windowStore.windows[windowId];
  if (!win?.attachedTo?.parentId) return null;

  let currentParentId: string | undefined = win.attachedTo.parentId;

  while (currentParentId) {
    const parentWin: WindowConfig | undefined =
      windowStore.windows[currentParentId];
    if (!parentWin) return null;

    // If this parent is visible (not hidden), return it
    if (parentWin.state !== "hidden") {
      return parentWin;
    }

    // Otherwise, continue up the chain
    currentParentId = parentWin.attachedTo?.parentId;
  }

  return null;
}

/**
 * Update positions of all windows in an attachment chain.
 * Skips hidden windows when calculating Y positions - visible windows snap to nearest visible ancestor.
 * Attachment chain is preserved (not broken when windows are hidden).
 */
function updateAttachedWindowPositions(rootId: string): void {
  const rootWindow = windowStore.windows[rootId];
  if (!rootWindow) return;

  // Get all windows in the chain
  const chain = getAttachmentChain(rootId, Object.values(windowStore.windows));

  // Root X position - all windows align to this (use previous position if root is hidden)
  const rootX =
    rootWindow.state === "hidden"
      ? (rootWindow.previousPosition?.x ?? rootWindow.position.x)
      : rootWindow.position.x;

  for (const child of chain) {
    // Skip hidden windows - they don't need position updates
    if (child.state === "hidden") continue;

    // Find the nearest visible ancestor
    const visibleAncestor = findVisibleAncestor(child.id);

    if (visibleAncestor) {
      // Position below the visible ancestor
      child.position = {
        x: rootX,
        y: getWindowBottom(visibleAncestor),
      };
    } else if (rootWindow.state !== "hidden") {
      // No visible ancestor but root is visible - position below root
      child.position = {
        x: rootX,
        y: getWindowBottom(rootWindow),
      };
    } else {
      // Root is hidden and no visible ancestor - take root's previous position
      // This is the first visible window in the chain, it takes the hidden root's place
      const rootY = rootWindow.previousPosition?.y ?? rootWindow.position.y;
      child.position = {
        x: rootX,
        y: rootY,
      };
    }
  }
}

/**
 * Recalculate positions for entire chain when a window is hidden.
 * The attachment chain stays intact - we just skip hidden windows when positioning.
 */
function cascadeOnHide(hiddenWindowId: string): void {
  // Find the root of the chain and update all positions
  const rootId = findChainRoot(hiddenWindowId);
  updateAttachedWindowPositions(rootId);
}

/**
 * Recalculate positions for entire chain when a window is restored.
 * The attachment chain stays intact - restored window takes its place and pushes others down.
 */
function cascadeOnRestore(restoredWindowId: string): void {
  // Find the root of the chain and update all positions
  const rootId = findChainRoot(restoredWindowId);
  updateAttachedWindowPositions(rootId);
}
