import type { ReactNode } from "react";

export type WindowState = "normal" | "maximized" | "minimized" | "hidden";

export type WindowAction = "close" | "minimize" | "maximize" | "hide";

export type DockState = "left" | "right" | "none";

type DockSide = Exclude<DockState, "none">;

export function isDockSide(state: DockState): state is DockSide {
  return state === "left" || state === "right";
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DockAreaConfig {
  width: number;
  collapsed: boolean;
  windowOrder: string[];
}

export type SnapPreviewType =
  | { type: "edge"; side: "left" | "right" }
  | {
      type: "dock-insert";
      side: "left" | "right";
      insertIndex: number;
      indicatorY: number;
      areaLeft: number;
      areaWidth: number;
    };

export interface WindowRef {
  id: string;
  close: () => void;
  minimize: () => void;
  maximize: () => void;
  hide: () => void;
  restore: () => void;
}

export interface WindowOptions {
  id?: string;
  title: string;
  position?: Position;
  size?: Size;
  minSize?: Size;
  linkedEntityId?: string;
  disabledActions?: WindowAction[];
  startVisible?: boolean;
  defaultVisible?: boolean;
  persisted?: boolean;
  defaultDockState?: "left" | "right";
  variant?: "window" | "panel";
  fillDockHeight?: boolean;
  minDockedHeight?: number;
  onClose?: () => void;
  // Without miniContent a window is filtered out of the collapsed dock strip, so
  // it is unreachable until the user expands the dock area again.
  miniContent?: ReactNode;
  renderMiniInline?: boolean;
}

// All dimensions below are CSS pixels. See src/routes/v2/WINDOWS.md for what each one drives.
export const DEFAULT_WINDOW_SIZE: Size = {
  width: 320,
  height: 420,
};

export const DEFAULT_MIN_SIZE: Size = {
  width: 280,
  height: 200,
};

export const CASCADE_OFFSET = 24;

export const EDGE_SNAP_THRESHOLD = 2;

export const DEFAULT_DOCK_AREA_WIDTH = 320;

export const MIN_DOCK_AREA_WIDTH = 220;

export const DOCK_AREA_COLLAPSE_SNAP_THRESHOLD = MIN_DOCK_AREA_WIDTH - 20;

export const MAX_DOCK_AREA_WIDTH = 600;

export const COLLAPSED_DOCK_AREA_WIDTH = 36;

export const DOCK_AREA_EXPAND_SNAP_THRESHOLD = COLLAPSED_DOCK_AREA_WIDTH + 24;

export const DEFAULT_DOCKED_HEIGHT = 300;

export const MIN_DOCKED_HEIGHT = 50;

export const DOCKED_HEADER_HEIGHT = 36;

export const DOCK_AREA_SNAP_THRESHOLD = 40;

export const WINDOW_CHROME_HEIGHT = 30;
