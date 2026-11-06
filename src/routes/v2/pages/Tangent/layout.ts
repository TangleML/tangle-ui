import {
  COLLAPSED_DOCK_AREA_WIDTH,
  DOCK_AREA_SNAP_OVERSHOOT,
  MIN_DOCK_AREA_WIDTH,
} from "@/routes/v2/shared/windows/types";

export const DEFAULT_CHAT_WIDTH = 480;
export const MIN_CHAT_WIDTH = 380;
export const MAX_CHAT_WIDTH = 760;

export const MIN_WORKAREA_WIDTH = 420;

export function narrowLayoutWidth(workareaCollapsed: boolean): number {
  return (
    MIN_CHAT_WIDTH +
    (workareaCollapsed ? COLLAPSED_DOCK_AREA_WIDTH : MIN_WORKAREA_WIDTH) +
    MIN_DOCK_AREA_WIDTH
  );
}

export const NARROW_LAYOUT_WIDTH = narrowLayoutWidth(false);

// Like the left dock, the workarea snaps shut once the divider is dragged a
// little past where it stops: the chat's maximum or the workarea's minimum,
// whichever binds first.
export function snapsWorkareaShut(
  rowMeasured: boolean,
  maxChatWidth: number,
  attemptedChatWidth: number,
): boolean {
  return (
    rowMeasured && attemptedChatWidth >= maxChatWidth + DOCK_AREA_SNAP_OVERSHOOT
  );
}

export const WORKAREA_ID = "tangent-project-workarea";
