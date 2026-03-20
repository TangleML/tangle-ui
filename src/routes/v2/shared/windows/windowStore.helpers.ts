import {
  DEFAULT_MIN_SIZE,
  type DockState,
  type Position,
  type Size,
  type WindowConfig,
  type WindowOptions,
} from "./types";
import type { getPersistedWindowState } from "./windowPersistence";

type PersistedState = ReturnType<typeof getPersistedWindowState>;

export function saveWindowSnapshot(win: WindowConfig): void {
  win.previousState = win.state;
  win.previousPosition = { ...win.position };
  win.previousSize = { ...win.size };
}
export function restoreWindowSnapshot(win: WindowConfig): void {
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
export function resolveInitialState(
  persisted: PersistedState,
  options: WindowOptions,
  dockState: DockState,
): { state: WindowConfig["state"]; needsPreviousState: boolean } {
  const shouldStartHidden = !!persisted?.isHidden && !options.startVisible;
  const shouldStartMinimized =
    !shouldStartHidden && !!persisted?.isMinimized && dockState !== "none";

  return {
    state: shouldStartHidden
      ? "hidden"
      : shouldStartMinimized
        ? "minimized"
        : "normal",
    needsPreviousState: shouldStartHidden || shouldStartMinimized,
  };
}
export function buildWindowConfig(
  id: string,
  options: WindowOptions,
  persisted: PersistedState,
  position: Position,
  size: Size,
  dockState: DockState,
  initial: { state: WindowConfig["state"]; needsPreviousState: boolean },
): WindowConfig {
  return {
    id,
    title: options.title,
    state: initial.state,
    position,
    size,
    minSize: options.minSize ?? { ...DEFAULT_MIN_SIZE },
    linkedEntityId: options.linkedEntityId,
    disabledActions: options.disabledActions,
    dockState,
    dockedHeight: persisted?.dockedHeight,
    preDockedPosition: persisted?.preDockedPosition
      ? { ...persisted.preDockedPosition }
      : undefined,
    preDockedSize: persisted?.preDockedSize
      ? { ...persisted.preDockedSize }
      : undefined,
    previousState: initial.needsPreviousState ? "normal" : undefined,
    previousPosition: initial.needsPreviousState ? { ...position } : undefined,
    previousSize: initial.needsPreviousState ? { ...size } : undefined,
    persisted: !!options.persisted,
  };
}
