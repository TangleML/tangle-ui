/** Window display state */
export type WindowState = "normal" | "maximized" | "minimized" | "hidden";

/** Actions that can be performed on a window */
export type WindowAction = "close" | "minimize" | "maximize" | "hide";

/** Docking state for edge snapping */
export type DockState = "left" | "right" | "none";

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

/** Information about window attachment to another window */
export interface AttachmentInfo {
  /** ID of the parent window this is attached to */
  parentId: string;
  /** X offset from parent's left edge (for alignment preservation) */
  offsetX: number;
}

/** Snap preview types for visual feedback during drag */
export type SnapPreviewType =
  | { type: "edge"; side: "left" | "right" }
  | {
      type: "attach";
      parentId: string;
      parentBottom: number;
      parentLeft: number;
    };

/** Window configuration stored in the registry (no React elements) */
export interface WindowConfig {
  id: string;
  title: string;
  state: WindowState;
  position: Position;
  size: Size;
  minSize: Size;
  /** Stored for restore operations (hide/minimize/maximize) */
  previousPosition?: Position;
  previousSize?: Size;
  previousState?: WindowState;
  /** Stored specifically for undocking - separate from hide/restore cycle */
  preDockedPosition?: Position;
  preDockedSize?: Size;
  /** Optional entity ID this window is linked to (for auto-close on entity deletion) */
  linkedEntityId?: string;
  /** Actions that are disabled for this window */
  disabledActions?: WindowAction[];
  /** Docking state for edge snapping */
  dockState: DockState;
  /** Attachment info if this window is attached to another window's bottom */
  attachedTo?: AttachmentInfo;
}

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
  /** ID of a window to attach this window below (for vertical stacking) */
  attachTo?: string;
  /** If true, window starts visible even if persisted state was hidden. Use for selection-driven windows. */
  startVisible?: boolean;
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

/** Distance from another window's bottom to trigger magnetic attachment (px) */
export const MAGNETIC_SNAP_THRESHOLD = 5;

/** Distance to drag before detaching from parent window (px) */
export const DETACH_THRESHOLD = 10;

/** Approximate height of the TaskPanel bar (px). Used to offset docked windows when TaskPanel is visible. */
export const TASK_PANEL_HEIGHT = 43;
