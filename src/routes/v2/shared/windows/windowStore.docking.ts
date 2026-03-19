import { emitDockAreaEvent } from "./dockAreaPlugins";
import {
  DEFAULT_DOCKED_HEIGHT,
  type DockAreaConfig,
  type DockState,
  type WindowConfig,
} from "./types";

type DockAreas = { left: DockAreaConfig; right: DockAreaConfig };

export function removeFromDockAreaOrder(
  dockAreas: DockAreas,
  id: string,
): void {
  for (const side of ["left", "right"] as const) {
    const order = dockAreas[side].windowOrder;
    const idx = order.indexOf(id);
    if (idx !== -1) {
      order.splice(idx, 1);
      return;
    }
  }
}

export function dockWindow(
  windows: Record<string, WindowConfig>,
  dockAreas: DockAreas,
  id: string,
  side: DockState,
  insertIndex?: number,
): void {
  const win = windows[id];
  if (!win || side === "none") return;

  if (win.dockState === "none") {
    win.preDockedPosition = { ...win.position };
    win.preDockedSize = { ...win.size };
  }

  removeFromDockAreaOrder(dockAreas, id);

  win.dockState = side;
  win.dockedHeight = win.dockedHeight ?? DEFAULT_DOCKED_HEIGHT;

  const dockArea = dockAreas[side];
  if (insertIndex !== undefined && insertIndex >= 0) {
    const clampedIndex = Math.min(insertIndex, dockArea.windowOrder.length);
    dockArea.windowOrder.splice(clampedIndex, 0, id);
  } else {
    dockArea.windowOrder.push(id);
  }

  dockArea.collapsed = false;

  emitDockAreaEvent({ type: "window-docked", side, windowId: id });
}

export function undockWindow(
  windows: Record<string, WindowConfig>,
  dockAreas: DockAreas,
  id: string,
): void {
  const win = windows[id];
  if (!win || win.dockState === "none") return;

  removeFromDockAreaOrder(dockAreas, id);

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

export function isWindowDocked(
  windows: Record<string, WindowConfig>,
  id: string,
): boolean {
  const win = windows[id];
  return win?.dockState !== "none" && win?.dockState !== undefined;
}

export function updateDockedWindowHeight(
  windows: Record<string, WindowConfig>,
  id: string,
  height: number,
): void {
  const win = windows[id];
  if (!win) return;
  win.dockedHeight = Math.max(100, height);
}

export function setDockAreaWidth(
  dockAreas: DockAreas,
  side: "left" | "right",
  width: number,
): void {
  dockAreas[side].width = width;
}

export function toggleDockAreaCollapsed(
  dockAreas: DockAreas,
  side: "left" | "right",
): void {
  dockAreas[side].collapsed = !dockAreas[side].collapsed;
}

export function getDockAreaWindowIds(
  dockAreas: DockAreas,
  side: "left" | "right",
): string[] {
  return dockAreas[side].windowOrder;
}

export function restoreDockArea(
  dockAreas: DockAreas,
  side: "left" | "right",
  state: { width: number; collapsed: boolean; windowOrder: string[] },
): void {
  dockAreas[side].width = state.width;
  dockAreas[side].collapsed = state.collapsed;
  dockAreas[side].windowOrder = [...state.windowOrder];
}
