import {
  DEFAULT_MIN_SIZE,
  DEFAULT_WINDOW_SIZE,
  type DockState,
  type Position,
  type Size,
  type WindowOptions,
  type WindowState,
} from "./types";
import { bringIntoViewport, type ViewportBounds } from "./viewportUtils";
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
  viewportBounds?: ViewportBounds,
): WindowModelInit {
  const persisted = options.persisted ? getPersistedWindowState(id) : null;
  const docked = resolveDockedOverrides(persisted, options.defaultDockState);
  const geo = resolveGeometry(
    persisted,
    options,
    defaultPosition,
    docked.dockState,
    viewportBounds,
  );
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
    variant: options.variant ?? "window",
    fillDockHeight: options.fillDockHeight,
    renderMiniInline: options.renderMiniInline,
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
    // A persisted entry reflects the user's last explicit choice, so honor it on
    // reload. `startVisible` only governs the first-visit branch below (no saved
    // layout yet); it must not override a window the user deliberately hid.
    const shouldStartHidden = !!persisted.isHidden;
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

  if (options.persisted && !options.startVisible) {
    const shouldStartHidden =
      options.defaultVisible === false ||
      (options.defaultVisible === undefined &&
        !hasPersistedLayout() &&
        !DEFAULT_VIEW_PRESET.visible.has(id));
    if (shouldStartHidden) {
      return { state: "hidden", needsPreviousState: true };
    }
  }

  return { state: "normal", needsPreviousState: false };
}
function resolveGeometry(
  persisted: PersistedState,
  options: WindowOptions,
  defaultPosition: Position,
  dockState: DockState,
  viewportBounds?: ViewportBounds,
): { position: Position; size: Size; minSize: Size } {
  const position = persisted?.position ?? options.position ?? defaultPosition;
  const size = persisted?.size ?? options.size ?? { ...DEFAULT_WINDOW_SIZE };
  const minSize = options.minSize ?? { ...DEFAULT_MIN_SIZE };

  // A floating window restored from persisted state may have been saved on a
  // larger screen and now sit off the current viewport. Snap it back in so it
  // stays reachable. Only persisted floating windows are adjusted — docked
  // windows lay out via their dock area, and fresh/default positions are honored.
  const restoredFloating = persisted !== null && dockState === "none";
  const resolvedPosition =
    restoredFloating && viewportBounds
      ? bringIntoViewport(position, size, viewportBounds)
      : position;

  return { position: resolvedPosition, size, minSize };
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
