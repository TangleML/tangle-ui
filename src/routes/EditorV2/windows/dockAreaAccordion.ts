/**
 * Accordion plugin for dock areas.
 *
 * Ensures only one window can be expanded (not minimized) at a time within
 * a dock area. Tracks auto-collapsed windows in a private stack so the
 * previously expanded window can be restored when the "intruder" is closed
 * or manually minimized.
 *
 * Usage:
 *   const cleanup = initDockAreaAccordion("right");
 *   // later: cleanup();
 */

import type { DockAreaEvent } from "./dockAreaPlugins";
import { registerDockAreaPlugin } from "./dockAreaPlugins";
import { windowStore } from "./windowStore";

const autoCollapsedStacks = new Map<string, string[]>();

function getStack(side: string): string[] {
  let stack = autoCollapsedStacks.get(side);
  if (!stack) {
    stack = [];
    autoCollapsedStacks.set(side, stack);
  }
  return stack;
}

/**
 * Minimize all expanded windows in a dock area except the given one.
 * Returns the IDs of windows that were collapsed.
 */
function collapseOthers(side: "left" | "right", exceptId: string): string[] {
  const dockArea = windowStore.dockAreas[side];
  const collapsed: string[] = [];

  for (const id of dockArea.windowOrder) {
    if (id === exceptId) continue;
    const win = windowStore.windows[id];
    if (win && win.state !== "minimized" && win.state !== "hidden") {
      win.previousState = win.state;
      win.previousPosition = { ...win.position };
      win.previousSize = { ...win.size };
      win.state = "minimized";
      collapsed.push(id);
    }
  }

  return collapsed;
}

/** Restore a single window from minimized to normal (without emitting events). */
function restoreQuietly(id: string): void {
  const win = windowStore.windows[id];
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

/**
 * Pop the first valid window from the auto-collapsed stack and restore it.
 * Skips entries that are no longer in the dock area.
 */
function restoreFromStack(side: "left" | "right"): void {
  const stack = getStack(side);
  const dockOrder = windowStore.dockAreas[side].windowOrder;

  while (stack.length > 0) {
    const restoreId = stack.pop()!;
    if (dockOrder.includes(restoreId) && windowStore.windows[restoreId]) {
      restoreQuietly(restoreId);
      return;
    }
  }
}

function accordionPlugin(event: DockAreaEvent): void {
  const { side, windowId } = event;
  const stack = getStack(side);

  switch (event.type) {
    case "window-docked": {
      const collapsed = collapseOthers(side, windowId);
      stack.push(...collapsed);
      break;
    }

    case "window-expanded": {
      collapseOthers(side, windowId);
      stack.length = 0;
      break;
    }

    case "window-closing": {
      const win = windowStore.windows[windowId];
      if (win && win.state !== "minimized") {
        restoreFromStack(side);
      }
      // Clean up any references to the closing window in the stack
      const idx = stack.indexOf(windowId);
      if (idx !== -1) stack.splice(idx, 1);
      break;
    }

    case "window-minimized": {
      restoreFromStack(side);
      break;
    }
  }
}

/** Initialize accordion behavior for a dock area side. Returns a cleanup function. */
export function initDockAreaAccordion(side: "left" | "right"): () => void {
  autoCollapsedStacks.set(side, []);
  const unsubscribe = registerDockAreaPlugin(side, accordionPlugin);

  return () => {
    unsubscribe();
    autoCollapsedStacks.delete(side);
  };
}
