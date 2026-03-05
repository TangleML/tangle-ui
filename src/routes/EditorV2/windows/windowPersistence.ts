/**
 * Window layout persistence module.
 *
 * Persists window arrangement (position, size, docking, attachments, hidden state)
 * to localStorage for static windows. On page reload, windows restore their
 * previous arrangement. Also persists dock area configuration.
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
interface PersistedWindowState {
  position: Position;
  size: Size;
  dockState: DockState;
  attachedTo?: AttachmentInfo;
  isHidden: boolean;
  preDockedPosition?: Position;
  preDockedSize?: Size;
  dockedHeight?: number;
}

interface PersistedDockAreaState {
  width: number;
  collapsed: boolean;
  windowOrder: string[];
}

/**
 * Full persisted layout including all static windows and their z-order.
 */
interface PersistedWindowLayout {
  windows: Record<string, PersistedWindowState>;
  windowOrder: string[];
  dockAreas: {
    left: PersistedDockAreaState;
    right: PersistedDockAreaState;
  };
  version: number;
}

const CURRENT_VERSION = 2;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

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

function saveWindowLayoutImmediate(): void {
  const existingLayout = loadWindowLayout();

  const layout: PersistedWindowLayout = {
    windows: existingLayout?.windows ?? {},
    windowOrder: [],
    dockAreas: {
      left: {
        width: windowStore.dockAreas.left.width,
        collapsed: windowStore.dockAreas.left.collapsed,
        windowOrder: windowStore.dockAreas.left.windowOrder.filter((id) =>
          STATIC_WINDOW_IDS.has(id),
        ),
      },
      right: {
        width: windowStore.dockAreas.right.width,
        collapsed: windowStore.dockAreas.right.collapsed,
        windowOrder: windowStore.dockAreas.right.windowOrder.filter((id) =>
          STATIC_WINDOW_IDS.has(id),
        ),
      },
    },
    version: CURRENT_VERSION,
  };

  for (const id of STATIC_WINDOW_IDS) {
    const window = windowStore.windows[id];
    if (window) {
      layout.windows[id] = {
        position: { ...window.position },
        size: { ...window.size },
        dockState: window.dockState,
        attachedTo: window.attachedTo ? { ...window.attachedTo } : undefined,
        isHidden: window.state === "hidden",
        preDockedPosition: window.preDockedPosition
          ? { ...window.preDockedPosition }
          : undefined,
        preDockedSize: window.preDockedSize
          ? { ...window.preDockedSize }
          : undefined,
        dockedHeight: window.dockedHeight,
      };
    }
  }

  layout.windowOrder = windowStore.windowOrder.filter((id) =>
    STATIC_WINDOW_IDS.has(id),
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

const saveWindowLayout = debounce(saveWindowLayoutImmediate, 500);

function loadWindowLayout(): PersistedWindowLayout | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const layout = JSON.parse(stored) as PersistedWindowLayout;

    if (layout.version !== CURRENT_VERSION) {
      return null;
    }

    return layout;
  } catch {
    return null;
  }
}

/**
 * Get persisted state for a specific window ID.
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
 * Restore persisted dock area state into the window store.
 * Called once during initialization.
 */
function restoreDockAreaState(): void {
  const layout = loadWindowLayout();
  if (!layout?.dockAreas) return;

  for (const side of ["left", "right"] as const) {
    const persisted = layout.dockAreas[side];
    if (!persisted) continue;
    windowStore.dockAreas[side].width = persisted.width;
    windowStore.dockAreas[side].collapsed = persisted.collapsed;
    // Pre-populate the window order from persisted state.
    // openWindow() will skip adding IDs that are already present,
    // preserving the persisted ordering.
    windowStore.dockAreas[side].windowOrder = [...persisted.windowOrder];
  }
}

/**
 * Initialize persistence by subscribing to windowStore changes.
 * Call this once when EditorV2 mounts.
 */
export function initPersistence(): () => void {
  if (unsubscribe) {
    unsubscribe();
  }

  // Restore dock area dimensions/collapsed state
  restoreDockAreaState();

  unsubscribe = subscribe(windowStore, () => {
    saveWindowLayout();
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  };
}
