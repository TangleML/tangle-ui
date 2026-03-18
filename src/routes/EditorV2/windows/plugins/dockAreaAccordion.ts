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

import type { DockAreaEvent } from "@/routes/EditorV2/windows/dockAreaPlugins";
import { registerDockAreaPlugin } from "@/routes/EditorV2/windows/dockAreaPlugins";
import {
  getDockAreaConfig,
  getWindowById,
  minimizeWindowQuietly,
  restoreWindowQuietly,
} from "@/routes/EditorV2/windows/windows.actions";

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
  const dockArea = getDockAreaConfig(side);
  const collapsed: string[] = [];

  for (const id of dockArea.windowOrder) {
    if (id === exceptId) continue;
    const win = getWindowById(id);
    if (win && win.state !== "minimized" && win.state !== "hidden") {
      minimizeWindowQuietly(id);
      collapsed.push(id);
    }
  }

  return collapsed;
}

/**
 * Pop the first valid window from the auto-collapsed stack and restore it.
 * Skips entries that are no longer in the dock area.
 */
function restoreFromStack(side: "left" | "right"): void {
  const stack = getStack(side);
  const dockOrder = getDockAreaConfig(side).windowOrder;

  while (stack.length > 0) {
    const restoreId = stack.pop();
    if (
      restoreId &&
      dockOrder.includes(restoreId) &&
      getWindowById(restoreId)
    ) {
      restoreWindowQuietly(restoreId);
      return;
    }
  }
}

function accordionPlugin(event: DockAreaEvent): void {
  const { side, windowId } = event;
  const stack = getStack(side);

  switch (event.type) {
    case "window-docked": {
      const win = getWindowById(windowId);
      if (win && win.state === "minimized") {
        break;
      }
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
      const win = getWindowById(windowId);
      if (win && win.state !== "minimized") {
        restoreFromStack(side);
      }
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
