import {
  DEFAULT_MIN_SIZE,
  DEFAULT_WINDOW_SIZE,
  type DockState,
  type Position,
  type Size,
  type WindowOptions,
  type WindowState,
} from "./types";
import { DEFAULT_VIEW_PRESET } from "./viewPresets";
import type { WindowModelInit } from "./windowModel";
import {
  getPersistedWindowState,
  hasPersistedLayout,
} from "./windowPersistence";

type PersistedState = ReturnType<typeof getPersistedWindowState>;

export function buildWindowModelInit(
  id: string,
  options: WindowOptions,
  defaultPosition: Position,
): WindowModelInit {
  const persisted = options.persisted ? getPersistedWindowState(id) : null;
  const geo = resolveGeometry(persisted, options, defaultPosition);
  const docked = resolveDockedOverrides(persisted, options.defaultDockState);
  const initial = resolveInitialState(persisted, options, docked.dockState, id);

  return {
    id,
    title: options.title,
    state: initial.state,
    ...geo,
    linkedEntityId: options.linkedEntityId,
    disabledActions: options.disabledActions,
    ...docked,
    previousState: initial.needsPreviousState ? "normal" : undefined,
    previousPosition: initial.needsPreviousState
      ? { ...geo.position }
      : undefined,
    previousSize: initial.needsPreviousState ? { ...geo.size } : undefined,
    persisted: !!options.persisted,
    onClose: options.onClose,
  };
}
function resolveInitialState(
  persisted: PersistedState,
  options: WindowOptions,
  dockState: DockState,
  id: string,
): { state: WindowState; needsPreviousState: boolean } {
  if (persisted) {
    const shouldStartHidden = !!persisted.isHidden && !options.startVisible;
    const shouldStartMinimized =
      !shouldStartHidden && !!persisted.isMinimized && dockState !== "none";

    return {
      state: shouldStartHidden
        ? "hidden"
        : shouldStartMinimized
          ? "minimized"
          : "normal",
      needsPreviousState: shouldStartHidden || shouldStartMinimized,
    };
  }

  if (options.persisted && !hasPersistedLayout()) {
    if (!DEFAULT_VIEW_PRESET.visible.has(id)) {
      return { state: "hidden", needsPreviousState: true };
    }
  }

  return { state: "normal", needsPreviousState: false };
}
function resolveGeometry(
  persisted: PersistedState,
  options: WindowOptions,
  defaultPosition: Position,
): { position: Position; size: Size; minSize: Size } {
  return {
    position: persisted?.position ?? options.position ?? defaultPosition,
    size: persisted?.size ?? options.size ?? { ...DEFAULT_WINDOW_SIZE },
    minSize: options.minSize ?? { ...DEFAULT_MIN_SIZE },
  };
}
function resolveDockedOverrides(
  persisted: PersistedState,
  defaultDockState?: "left" | "right",
): {
  dockState: DockState;
  dockedHeight: number | undefined;
  preDockedPosition: Position | undefined;
  preDockedSize: Size | undefined;
} {
  const dockState: DockState =
    persisted?.dockState ?? defaultDockState ?? "none";
  return {
    dockState,
    dockedHeight: persisted?.dockedHeight,
    preDockedPosition: persisted?.preDockedPosition
      ? { ...persisted.preDockedPosition }
      : undefined,
    preDockedSize: persisted?.preDockedSize
      ? { ...persisted.preDockedSize }
      : undefined,
  };
}
