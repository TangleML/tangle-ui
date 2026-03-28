/**
 * Window layout persistence module.
 *
 * Persists window arrangement (position, size, docking, hidden state)
 * to localStorage for windows marked with `persisted: true`. On page reload,
 * windows restore their previous arrangement. Also persists dock area configuration.
 */

import { reaction } from "mobx";
import { useEffect } from "react";

import { debounce } from "@/utils/debounce";
import { getStorage } from "@/utils/typedStorage";

import { useSharedStores } from "../store/SharedStoreContext";
import type { DockState, Position, Size } from "./types";
import type { WindowStoreImpl } from "./windowStore";

/**
 * Tracks which layout is currently active so that module-level functions
 * (save/load/getPersistedWindowState) use the correct localStorage key.
 */
let activeLayoutId: string | null = null;

function getStorageKey(): string {
  if (!activeLayoutId) return "editorV2-window-layout";
  return `window-layout-${activeLayoutId}`;
}

/**
 * Persisted state for a single window (subset of WindowConfig).
 */
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

/**
 * Full persisted layout including all persisted windows and their z-order.
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

type WindowLayoutStorageMap = Record<string, PersistedWindowLayout>;

const storage = getStorage<string, WindowLayoutStorageMap>();

const CURRENT_VERSION = 4;

function saveWindowLayoutImmediate(store: WindowStoreImpl): void {
  const existingLayout = loadWindowLayout();

  const leftDock = store.getDockAreaConfig("left");
  const rightDock = store.getDockAreaConfig("right");

  const layout: PersistedWindowLayout = {
    windows: existingLayout?.windows ?? {},
    windowOrder: [],
    dockAreas: {
      left: {
        width: leftDock.width,
        collapsed: leftDock.collapsed,
        windowOrder: leftDock.windowOrder.filter((id) =>
          store.isWindowPersisted(id),
        ),
      },
      right: {
        width: rightDock.width,
        collapsed: rightDock.collapsed,
        windowOrder: rightDock.windowOrder.filter((id) =>
          store.isWindowPersisted(id),
        ),
      },
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
        isMinimized: win.state === "minimized",
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
