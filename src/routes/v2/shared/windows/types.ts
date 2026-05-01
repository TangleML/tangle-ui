import type { ReactNode } from "react";

/** Window display state */
export type WindowState = "normal" | "maximized" | "minimized" | "hidden";

/** Actions that can be performed on a window */
export type WindowAction = "close" | "minimize" | "maximize" | "hide";

/** Docking state for edge snapping */
export type DockState = "left" | "right" | "none";

type DockSide = Exclude<DockState, "none">;

/** Type guard: narrows DockState to a concrete dock side ("left" | "right"). */
export function isDockSide(state: DockState): state is DockSide {
  return state === "left" || state === "right";
}

/** Position coordinates */
export interface Position {
  x: number;
  y: number;
}

/** Size dimensions */
export interface Size {
  width: number;
  height: number;
}

/** Configuration for a dock area column */
export interface DockAreaConfig {
  width: number;
  collapsed: boolean;
  windowOrder: string[];
}

/** Snap preview types for visual feedback during drag */
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

/** Reference returned from open() for controlling a window */
export interface WindowRef {
  id: string;
  close: () => void;
  minimize: () => void;
  maximize: () => void;
  hide: () => void;
  restore: () => void;
}

/** Options for opening a new window */
export interface WindowOptions {
  /** Explicit ID - auto-generated if not provided */
  id?: string;
  /** Window title displayed in header */
  title: string;
  /** Initial position - defaults to cascaded from last window */
  position?: Position;
  /** Initial size - defaults to 320x420 */
  size?: Size;
  /** Minimum size for resizing - defaults to 280x200 */
  minSize?: Size;
  /** Optional entity ID to link this window to (for auto-close on entity deletion) */
  linkedEntityId?: string;
  /** Actions to disable for this window (e.g., ["close"] for non-closable windows) */
  disabledActions?: WindowAction[];
  /** If true, window starts visible even if persisted state was hidden. Use for selection-driven windows. */
  startVisible?: boolean;
  /** If true, the window's layout (position, size, dock state) is persisted to localStorage across reloads. */
  persisted?: boolean;
  /** Default dock side for first-time users (no persisted state). */
  defaultDockState?: "left" | "right";
  /** Callback to invoke when the window is closed */
  onClose?: () => void;
  /**
   * Optional compact control shown when the window is docked and its dock area
   * is collapsed. Typically an icon button; click opens full content in a popover.
   */
  miniContent?: ReactNode;
}

/** Default window dimensions */
export const DEFAULT_WINDOW_SIZE: Size = {
  width: 320,
  height: 420,
};

export const DEFAULT_MIN_SIZE: Size = {
  width: 280,
  height: 200,
};

/** Cascade offset for new windows */
export const CASCADE_OFFSET = 24;

/** Distance from viewport edge to trigger dock preview (px) */
export const EDGE_SNAP_THRESHOLD = 2;

/** Default dock area width (px) */
export const DEFAULT_DOCK_AREA_WIDTH = 320;

/** Minimum dock area width (px) */
export const MIN_DOCK_AREA_WIDTH = 220;

/** Maximum dock area width (px) */
export const MAX_DOCK_AREA_WIDTH = 600;

/** Collapsed dock area width (px) */
export const COLLAPSED_DOCK_AREA_WIDTH = 36;

/** Default height for a docked window (px) */
export const DEFAULT_DOCKED_HEIGHT = 300;

/** Minimum height for a docked window (px) */
export const MIN_DOCKED_HEIGHT = 100;

/** Distance from dock area edge to trigger dock insert preview (px) */
export const DOCK_AREA_SNAP_THRESHOLD = 40;
