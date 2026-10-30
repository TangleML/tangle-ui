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

export const TOUR_WINDOW_LAYOUT_ID = "tour";

function getLayoutStorageKey(layoutId: string | null): string {
  if (!layoutId) return "editorV2-window-layout";
  return `window-layout-${layoutId}`;
}

function getStorageKey(): string {
  return getLayoutStorageKey(activeLayoutId);
}

export function clearLayout(layoutId: string): void {
  try {
    localStorage.removeItem(getLayoutStorageKey(layoutId));
  } catch (error) {
    console.warn(`Failed to clear layout "${layoutId}":`, error);
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

const CURRENT_VERSION = 5;

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
    windowOrder: store
      .getDockedWindowOrder(side)
      .filter((id) => store.isWindowPersisted(id)),
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

// The height version 4 stamped onto docked windows. Frozen here rather than
// imported from DEFAULT_DOCKED_HEIGHT: this migration must keep matching the
// historical value even if that constant changes.
const V4_STAMPED_DOCKED_HEIGHT = 300;

/**
 * Version 4 stamped a default `dockedHeight` onto every window dragged into a
 * dock. That value was inert then, but is now an enforced pixel height, so it
 * pins panels that should size to their content. Dropping it restores
 * fit-to-content; an explicit resize writes the field again. Heights the user
 * actually chose are left alone — a drag starts from a fractional measured
 * height, so landing on the stamp exactly is vanishingly unlikely.
 */
export function migrateLayout(
  layout: PersistedWindowLayout,
): PersistedWindowLayout | null {
  if (layout.version === CURRENT_VERSION) return layout;
  if (layout.version !== 4) return null;

  const windows: Record<string, PersistedWindowState> = {};
  for (const [id, win] of Object.entries(layout.windows)) {
    const { dockedHeight, ...withoutDockedHeight } = win;
    windows[id] =
      dockedHeight === V4_STAMPED_DOCKED_HEIGHT ? withoutDockedHeight : win;
  }

  return { ...layout, windows, version: CURRENT_VERSION };
}

function loadWindowLayout(): PersistedWindowLayout | null {
  const parsed = storage.getItem(getStorageKey());
  if (!isPersistedLayout(parsed)) return null;

  return migrateLayout(parsed);
}

/**
 * Returns true when a valid persisted layout exists in localStorage.
 * Used to distinguish first-time users (no data) from returning users.
 */
export function hasPersistedLayout(): boolean {
  return loadWindowLayout() !== null;
}

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

export function useWindowPersistence(layoutId: string, enabled = true) {
  const { windows: store } = useSharedStores();
  useEffect(() => {
    if (!enabled) return;
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
  }, [layoutId, store, enabled]);
}
