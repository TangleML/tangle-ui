/**
 * Window layout persistence module.
 *
 * Persists window arrangement (position, size, docking, hidden state)
 * to localStorage for windows marked with `persisted: true`. On page reload,
 * windows restore their previous arrangement. Also persists dock area configuration.
 */

import { reaction } from "mobx";
import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { debounce } from "@/utils/debounce";
import { getStorage } from "@/utils/typedStorage";

import type { DockState, Position, Size } from "./types";
import type { WindowStoreImpl } from "./windowStore";

/**
 * Tracks which layout is currently active so that module-level functions
 * (save/load/getPersistedWindowState) use the correct localStorage key.
 */
let activeLayoutId: string | null = null;

function getLayoutStorageKey(layoutId: string | null): string {
  if (!layoutId) return "editorV2-window-layout";
  return `window-layout-${layoutId}`;
}

function getStorageKey(): string {
  return getLayoutStorageKey(activeLayoutId);
}

function snapshotStorageKey(layoutId: string): string {
  return `${getLayoutStorageKey(layoutId)}-snapshot`;
}

function snapshotActiveKey(layoutId: string): string {
  return `${snapshotStorageKey(layoutId)}-active`;
}

// Stashes the layout aside so the next mount starts from defaults. Pair with
// restoreLayout to roll back.
export function snapshotLayout(layoutId: string): void {
  try {
    const key = getLayoutStorageKey(layoutId);
    const current = localStorage.getItem(key);
    if (current !== null) {
      localStorage.setItem(snapshotStorageKey(layoutId), current);
    } else {
      localStorage.removeItem(snapshotStorageKey(layoutId));
    }
    localStorage.setItem(snapshotActiveKey(layoutId), "1");
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to snapshot layout "${layoutId}":`, error);
  }
}

export function restoreLayout(layoutId: string): boolean {
  try {
    if (localStorage.getItem(snapshotActiveKey(layoutId)) === null) {
      return false;
    }
    const key = getLayoutStorageKey(layoutId);
    const saved = localStorage.getItem(snapshotStorageKey(layoutId));
    if (saved !== null) {
      localStorage.setItem(key, saved);
    } else {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(snapshotStorageKey(layoutId));
    localStorage.removeItem(snapshotActiveKey(layoutId));
    return true;
  } catch (error) {
    console.warn(`Failed to restore layout "${layoutId}":`, error);
    return false;
  }
}

interface PersistedWindowState {
  position: Position;
  size: Size;
  dockState: DockState;
  isHidden: boolean;
  isMinimized: boolean;
  preDockedPosition?: Position;
  preDockedSize?: Size;
  dockedHeight?: number;
}

interface PersistedDockAreaState {
  width: number;
  collapsed: boolean;
  windowOrder: string[];
}

interface PersistedWindowLayout {
  windows: Record<string, PersistedWindowState>;
  windowOrder: string[];
  dockAreas: {
    left: PersistedDockAreaState;
    right: PersistedDockAreaState;
  };
  version: number;
}

type WindowLayoutStorageMap = Record<string, PersistedWindowLayout>;

const storage = getStorage<string, WindowLayoutStorageMap>();

const CURRENT_VERSION = 4;

function saveWindowLayoutImmediate(store: WindowStoreImpl): void {
  const existingLayout = loadWindowLayout();

  const layout: PersistedWindowLayout = {
    windows: existingLayout?.windows ?? {},
    windowOrder: [],
    dockAreas: {
      left: serializeDockArea(store, "left"),
      right: serializeDockArea(store, "right"),
    },
    version: CURRENT_VERSION,
  };

  for (const id of store.getPersistedWindowIds()) {
    const win = store.getWindowById(id);
    if (win) {
      layout.windows[id] = {
        position: { ...win.position },
        size: { ...win.size },
        dockState: win.dockState,
        isHidden: win.state === "hidden",
        isMinimized: win.isMinimized,
        preDockedPosition: win.preDockedPosition
          ? { ...win.preDockedPosition }
          : undefined,
        preDockedSize: win.preDockedSize ? { ...win.preDockedSize } : undefined,
        dockedHeight: win.dockedHeight,
      };
    }
  }

  layout.windowOrder = store.currentWindowOrder.filter((id) =>
    store.isWindowPersisted(id),
  );

  storage.setItem(getStorageKey(), layout);
}

function serializeDockArea(
  store: WindowStoreImpl,
  side: "left" | "right",
): PersistedDockAreaState {
  const config = store.getDockAreaConfig(side);
  return {
    width: config.width,
    collapsed: config.collapsed,
    windowOrder: config.windowOrder.filter((id) => store.isWindowPersisted(id)),
  };
}

const saveWindowLayout = debounce(saveWindowLayoutImmediate, 500);

function isPersistedLayout(value: unknown): value is PersistedWindowLayout {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "windows" in value &&
    "windowOrder" in value
  );
}

function loadWindowLayout(): PersistedWindowLayout | null {
  const parsed = storage.getItem(getStorageKey());
  if (!isPersistedLayout(parsed) || parsed.version !== CURRENT_VERSION) {
    return null;
  }
  return parsed;
}

/**
 * Returns true when a valid persisted layout exists in localStorage.
 * Used to distinguish first-time users (no data) from returning users.
 */
export function hasPersistedLayout(): boolean {
  return loadWindowLayout() !== null;
}

/**
 * Get persisted state for a specific window ID.
 */
export function getPersistedWindowState(
  id: string,
): PersistedWindowState | null {
  const layout = loadWindowLayout();
  if (!layout) {
    return null;
  }

  return layout.windows[id] ?? null;
}

function restoreDockAreaState(store: WindowStoreImpl): void {
  const layout = loadWindowLayout();
  if (!layout?.dockAreas) return;

  for (const side of ["left", "right"] as const) {
    const persisted = layout.dockAreas[side];
    if (!persisted) continue;
    store.restoreDockArea(side, {
      width: persisted.width,
      collapsed: persisted.collapsed,
      windowOrder: persisted.windowOrder,
    });
  }
}

export function useWindowPersistence(layoutId: string) {
  const { windows: store } = useSharedStores();
  useEffect(() => {
    activeLayoutId = layoutId;

    restoreDockAreaState(store);

    const unsubscribe = reaction(
      () => store.getSerializedStoreState(),
      () => {
        saveWindowLayout(store);
      },
    );

    return () => {
      unsubscribe();
      saveWindowLayout.cancel();
      activeLayoutId = null;
    };
  }, [layoutId, store]);
}
