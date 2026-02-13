import type { ReactNode } from "react";
import { proxy } from "valtio";

import {
  CASCADE_OFFSET,
  DEFAULT_MIN_SIZE,
  DEFAULT_WINDOW_SIZE,
  type Position,
  type Size,
  type WindowConfig,
  type WindowOptions,
  type WindowRef,
} from "./types";

export interface WindowStore {
  /** Map of window ID to window configuration */
  windows: Record<string, WindowConfig>;
  /** Ordered list of window IDs for z-index stacking (last = top) */
  windowOrder: string[];
}

export const windowStore = proxy<WindowStore>({
  windows: {},
  windowOrder: [],
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

  const config: WindowConfig = {
    id,
    title: options.title,
    state: "normal",
    position: options.position ?? calculateNewPosition(),
    size: options.size ?? { ...DEFAULT_WINDOW_SIZE },
    minSize: options.minSize ?? { ...DEFAULT_MIN_SIZE },
  };

  windowStore.windows[id] = config;
  windowStore.windowOrder.push(id);

  return createWindowRef(id);
}

/** Close a window (remove from registry) */
export function closeWindow(id: string): void {
  delete windowStore.windows[id];
  windowContentMap.delete(id);
  const index = windowStore.windowOrder.indexOf(id);
  if (index !== -1) {
    windowStore.windowOrder.splice(index, 1);
  }
}

/** Minimize a window (collapse to header only) */
export function minimizeWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window || window.state === "minimized") return;

  window.previousState = window.state;
  window.previousPosition = { ...window.position };
  window.previousSize = { ...window.size };
  window.state = "minimized";
}

/** Maximize a window (full screen) */
export function maximizeWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window || window.state === "maximized") return;

  window.previousState = window.state;
  window.previousPosition = { ...window.position };
  window.previousSize = { ...window.size };
  window.state = "maximized";
}

/** Hide a window (move to task panel) */
export function hideWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window || window.state === "hidden") return;

  window.previousState = window.state;
  window.previousPosition = { ...window.position };
  window.previousSize = { ...window.size };
  window.state = "hidden";
}

/** Restore a window to its previous state */
export function restoreWindow(id: string): void {
  const window = windowStore.windows[id];
  if (!window) return;

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
    window.size = size;
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

/** Get hidden windows only */
export function getHiddenWindows(): WindowConfig[] {
  return getAllWindows().filter((w) => w.state === "hidden");
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

/** Update window content */
export function updateWindowContent(id: string, content: ReactNode): void {
  windowContentMap.set(id, content);
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
