/** Window display state */
export type WindowState = "normal" | "maximized" | "minimized" | "hidden";

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

/** Window configuration stored in the registry (no React elements) */
export interface WindowConfig {
  id: string;
  title: string;
  state: WindowState;
  position: Position;
  size: Size;
  minSize: Size;
  /** Stored for restore operations */
  previousPosition?: Position;
  previousSize?: Size;
  previousState?: WindowState;
  /** Optional entity ID this window is linked to (for auto-close on entity deletion) */
  linkedEntityId?: string;
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

