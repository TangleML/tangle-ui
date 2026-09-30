import { MIN_DOCK_AREA_WIDTH } from "@/routes/v2/shared/windows/types";

/**
 * The chat column is the one with a fixed width, and the workarea takes
 * whatever is left. It used to be the other way round, which meant chat
 * swallowed every extra pixel on a wide screen and was squeezed out of
 * existence on a narrow one.
 */
export const DEFAULT_CHAT_WIDTH = 480;
export const MIN_CHAT_WIDTH = 380;
export const MAX_CHAT_WIDTH = 760;

export const MIN_WORKAREA_WIDTH = 420;

/**
 * Below this the three columns cannot all hold their minimum, so the left dock
 * gives up its width and shows icons instead.
 */
export const NARROW_LAYOUT_WIDTH =
  MIN_CHAT_WIDTH + MIN_WORKAREA_WIDTH + MIN_DOCK_AREA_WIDTH;
