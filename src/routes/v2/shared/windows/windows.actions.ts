/**
 * Public API for the window system.
 *
 * All mutations and queries go through these helpers so that the global
 * `windowStore` instance stays an internal detail of the `windows/` module.
 */

import type { ReactNode } from "react";

import type {
  DockAreaConfig,
  DockState,
  Position,
  Size,
  WindowConfig,
  WindowOptions,
  WindowRef,
} from "./types";
import { getWindowContent, windowStore } from "./windowStore";

// Re-export content helper
export { getWindowContent };

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function openWindow(
  content: ReactNode,
  options: WindowOptions,
): WindowRef {
  return windowStore.openWindow(content, options);
}

export function closeWindow(id: string): void {
  windowStore.closeWindow(id);
}

export function hideWindow(id: string): void {
  windowStore.hideWindow(id);
}

export function restoreWindow(id: string): void {
  windowStore.restoreWindow(id);
}

export function bringToFront(id: string): void {
  windowStore.bringToFront(id);
}

export function updateWindowPosition(id: string, position: Position): void {
  windowStore.updateWindowPosition(id, position);
}

export function updateWindowSize(id: string, size: Size): void {
  windowStore.updateWindowSize(id, size);
}

export function closeWindowsByLinkedEntity(entityId: string): void {
  windowStore.closeWindowsByLinkedEntity(entityId);
}

export function toggleMinimize(id: string): void {
  windowStore.toggleMinimize(id);
}

export function toggleMaximize(id: string): void {
  windowStore.toggleMaximize(id);
}

export function dockWindow(
  id: string,
  side: DockState,
  insertIndex?: number,
): void {
  windowStore.dockWindow(id, side, insertIndex);
}

export function undockWindow(id: string): void {
  windowStore.undockWindow(id);
}

export function updateDockedWindowHeight(id: string, height: number): void {
  windowStore.updateDockedWindowHeight(id, height);
}

export function setDockAreaWidth(side: "left" | "right", width: number): void {
  windowStore.setDockAreaWidth(side, width);
}

export function toggleDockAreaCollapsed(side: "left" | "right"): void {
  windowStore.toggleDockAreaCollapsed(side);
}

export function minimizeWindowQuietly(id: string): void {
  windowStore.minimizeWindowQuietly(id);
}

export function restoreWindowQuietly(id: string): void {
  windowStore.restoreWindowQuietly(id);
}

export function restoreDockArea(
  side: "left" | "right",
  state: { width: number; collapsed: boolean; windowOrder: string[] },
): void {
  windowStore.restoreDockArea(side, state);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getWindowById(id: string): WindowConfig | undefined {
  return windowStore.getWindowById(id);
}

export function getAllWindows(): WindowConfig[] {
  return windowStore.getAllWindows();
}

export function isWindowDocked(id: string): boolean {
  return windowStore.isWindowDocked(id);
}

export function getDockAreaWindowIds(side: "left" | "right"): string[] {
  return windowStore.getDockAreaWindowIds(side);
}

export function getDockAreaConfig(side: "left" | "right"): DockAreaConfig {
  return windowStore.dockAreas[side];
}

export function getHiddenWindows(): WindowConfig[] {
  return windowStore.windowOrder
    .map((id) => windowStore.windows[id])
    .filter((w) => w?.state === "hidden");
}

export function getWindowZIndex(id: string): number {
  return windowStore.windowOrder.indexOf(id);
}

export function isWindowAtFront(id: string): boolean {
  const idx = windowStore.windowOrder.indexOf(id);
  return idx === windowStore.windowOrder.length - 1;
}

export function getWindowOrderLength(): number {
  return windowStore.windowOrder.length;
}

export function hasHiddenWindows(): boolean {
  return windowStore.windowOrder.some(
    (id) => windowStore.windows[id]?.state === "hidden",
  );
}

export function isDockAreaCollapsed(side: DockState): boolean {
  if (side === "none") return false;
  return windowStore.dockAreas[side].collapsed;
}

export function getFloatingWindowIds(): string[] {
  return windowStore.windowOrder.filter(
    (id) => windowStore.windows[id]?.dockState === "none",
  );
}

export function getWindowOrder(): string[] {
  return windowStore.windowOrder;
}

export function getDockAreaWidth(side: "left" | "right"): number {
  return windowStore.dockAreas[side].width;
}

export function isWindowPersisted(id: string): boolean {
  return windowStore.windows[id]?.persisted === true;
}

export function getPersistedWindowIds(): string[] {
  return windowStore.windowOrder.filter(
    (id) => windowStore.windows[id]?.persisted,
  );
}

/** Deep-serialize all store state for MobX change tracking. */
export function getSerializedStoreState(): string {
  return JSON.stringify({
    w: windowStore.windows,
    o: windowStore.windowOrder,
    d: windowStore.dockAreas,
  });
}
