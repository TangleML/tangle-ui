import { TOP_NAV_HEIGHT } from "@/utils/constants";

export const NOTICE_BANNERS_HEIGHT_VAR = "--notice-banners-height";

export function contentHeight(subtractPx = 0): string {
  return `calc(100vh - ${TOP_NAV_HEIGHT}px - var(${NOTICE_BANNERS_HEIGHT_VAR}, 0px) - ${subtractPx}px)`;
}
