/**
 * Window layout persistence module.
 *
 * Persists window arrangement (position, size, docking, attachments, hidden state)
 * to localStorage for static windows. On page reload, windows restore their
 * previous arrangement.
 */

import { subscribe } from "valtio";

import type { AttachmentInfo, DockState, Position, Size } from "./types";
import { windowStore } from "./windowStore";

const STORAGE_KEY = "editorV2-window-layout";

/**
 * Set of static window IDs that should be persisted.
 * Only windows with these IDs will have their layout saved/restored.
 */
export const STATIC_WINDOW_IDS = new Set([
  "debug-panel",
  "context-panel",
  "component-library",
  "pipeline-details",
  "pipeline-tree",
  "history",
]);

/**
 * Persisted state for a single window (subset of WindowConfig).
 */
export interface PersistedWindowState {
  position: Position;
  size: Size;
  dockState: DockState;
  attachedTo?: AttachmentInfo;
  isHidden: boolean;
}

/**
 * Full persisted layout including all static windows and their z-order.
 */
interface PersistedWindowLayout {
  windows: Record<string, PersistedWindowState>;
  windowOrder: string[];
  version: number;
}

const CURRENT_VERSION = 1;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Simple debounce utility for saving.
 */
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      fn(...args);
      saveTimeout = null;
    }, delay);
  };
}

/**
 * Save current window layout to localStorage.
 * Only persists windows with static IDs.
 */
function saveWindowLayoutImmediate(): void {
  const layout: PersistedWindowLayout = {
    windows: {},
    windowOrder: [],
    version: CURRENT_VERSION,
  };

  // Only persist static windows
  for (const id of STATIC_WINDOW_IDS) {
    const window = windowStore.windows[id];
    if (window) {
      layout.windows[id] = {
        position: { ...window.position },
        size: { ...window.size },
        dockState: window.dockState,
        attachedTo: window.attachedTo
          ? { ...window.attachedTo }
          : undefined,
        isHidden: window.state === "hidden",
      };
    }
  }

  // Preserve order only for static windows
  layout.windowOrder = windowStore.windowOrder.filter((id) =>
    STATIC_WINDOW_IDS.has(id),
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Debounced save function (500ms delay) to avoid excessive writes during drag/resize.
 */
export const saveWindowLayout = debounce(saveWindowLayoutImmediate, 500);

/**
 * Load persisted window layout from localStorage.
 */
export function loadWindowLayout(): PersistedWindowLayout | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const layout = JSON.parse(stored) as PersistedWindowLayout;

    // Version check - if version doesn't match, discard
    if (layout.version !== CURRENT_VERSION) {
      return null;
    }

    return layout;
  } catch {
    // Invalid JSON or other error
    return null;
  }
}

/**
 * Get persisted state for a specific window ID.
 * Returns null if no persisted state exists.
 */
export function getPersistedWindowState(
  id: string,
): PersistedWindowState | null {
  if (!STATIC_WINDOW_IDS.has(id)) {
    return null;
  }

  const layout = loadWindowLayout();
  if (!layout) {
    return null;
  }

  return layout.windows[id] ?? null;
}

/**
 * Get persisted window order for static windows.
 */
export function getPersistedWindowOrder(): string[] {
  const layout = loadWindowLayout();
  if (!layout) {
    return [];
  }
  return layout.windowOrder;
}

/**
 * Initialize persistence by subscribing to windowStore changes.
 * Call this once when EditorV2 mounts.
 * Returns a cleanup function to unsubscribe.
 */
export function initPersistence(): () => void {
  // Unsubscribe from any previous subscription
  if (unsubscribe) {
    unsubscribe();
  }

  // Subscribe to all changes in windowStore
  unsubscribe = subscribe(windowStore, () => {
    saveWindowLayout();
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    // Clear any pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  };
}

/**
 * Clear persisted window layout (for testing/debugging).
 */
export function clearPersistedLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

