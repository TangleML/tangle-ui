/**
 * Accordion behavior for one window store's dock area.
 *
 * Ensures only one window can be expanded (not minimized) at a time within
 * a dock area. Tracks auto-collapsed windows in a private stack so the
 * previously expanded window can be restored when the "intruder" is closed
 * or manually minimized.
 */

import type { DockAreaEvent } from "./types";
import type { WindowStoreImpl } from "./windowStore";

/**
 * Minimize all expanded windows in a dock area except the given one.
 * Returns the IDs of windows that were collapsed.
 */
function collapseOthers(
  store: WindowStoreImpl,
  side: "left" | "right",
  exceptId: string,
): string[] {
  const dockArea = store.getDockAreaConfig(side);
  const collapsed: string[] = [];

  for (const id of dockArea.windowOrder) {
    if (id === exceptId) continue;
    const win = store.getWindowById(id);
    if (win && !win.isMinimized && win.state !== "hidden") {
      win.minimize({ quiet: true });
      collapsed.push(id);
    }
  }

  return collapsed;
}

/**
 * Pop the first valid window from the auto-collapsed stack and restore it.
 * Skips entries that are no longer in the dock area.
 */
function restoreFromStack(
  store: WindowStoreImpl,
  side: "left" | "right",
  stack: string[],
): void {
  const dockOrder = store.getDockAreaConfig(side).windowOrder;

  while (stack.length > 0) {
    const restoreId = stack.pop();
    if (
      restoreId &&
      dockOrder.includes(restoreId) &&
      store.getWindowById(restoreId)
    ) {
      store.getWindowById(restoreId)!.restore({ quiet: true });
      return;
    }
  }
}

/**
 * Guarantee at least one window is expanded in the dock area.
 * No-ops when any window is already visible; otherwise restores the first
 * minimized window it finds.
 */
function ensureOneVisible(
  store: WindowStoreImpl,
  side: "left" | "right",
  excludeId?: string,
): void {
  const dockArea = store.getDockAreaConfig(side);

  const hasVisible = dockArea.windowOrder.some((id) => {
    if (id === excludeId) return false;
    const win = store.getWindowById(id);
    return win && !win.isMinimized && win.state !== "hidden";
  });

  if (hasVisible) return;

  for (const id of dockArea.windowOrder) {
    if (id === excludeId) continue;
    const win = store.getWindowById(id);
    if (win?.isMinimized) {
      win.restore({ quiet: true });
      return;
    }
  }
}

export function createDockAreaAccordion(
  side: "left" | "right",
  store: WindowStoreImpl,
): (event: DockAreaEvent) => void {
  const stack: string[] = [];

  function onDockAreaEvent(event: DockAreaEvent): void {
    const { windowId } = event;

    switch (event.type) {
      case "window-docked": {
        const win = store.getWindowById(windowId);
        if (win?.isMinimized) {
          ensureOneVisible(store, side);
          break;
        }
        const collapsed = collapseOthers(store, side, windowId);
        stack.push(...collapsed);
        break;
      }

      case "window-expanded": {
        collapseOthers(store, side, windowId);
        stack.length = 0;
        break;
      }

      case "window-closing": {
        const win = store.getWindowById(windowId);
        if (win && !win.isMinimized) {
          restoreFromStack(store, side, stack);
        }
        const idx = stack.indexOf(windowId);
        if (idx !== -1) stack.splice(idx, 1);
        ensureOneVisible(store, side, windowId);
        break;
      }

      case "window-minimized": {
        // Manual minimize is allowed to leave the dock area fully collapsed —
        // we intentionally don't call ensureOneVisible here.
        restoreFromStack(store, side, stack);
        break;
      }
    }
  }

  // Ensure at least one window is expanded on initialization
  // (handles case where all windows loaded from persisted minimized state)
  ensureOneVisible(store, side);

  return onDockAreaEvent;
}
