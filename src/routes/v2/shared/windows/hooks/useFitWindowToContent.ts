import { type RefObject, useLayoutEffect } from "react";

import type { WindowModel } from "@/routes/v2/shared/windows/windowModel";

const AUTO_FIT_MAX_WIDTH = 720;
const AUTO_FIT_MAX_HEIGHT = 720;
const VIEWPORT_MARGIN = 16;

/**
 * On first mount, when `model.autoSize` is set, resize the window to fit its
 * content (clamped between `model.minSize` and a viewport-relative max), nudge
 * the position so the window stays in the viewport, then disable auto-sizing.
 * No-op for docked/maximized windows.
 */
export function useFitWindowToContent(
  model: WindowModel,
  contentRef: RefObject<HTMLElement | null>,
  headerHeight: number,
) {
  useLayoutEffect(() => {
    if (!model.autoSize) return;
    if (model.isDocked || model.isMaximized) return;

    const el = contentRef.current;
    if (!el) return;

    const naturalWidth = el.scrollWidth;
    const naturalHeight = el.scrollHeight + headerHeight;

    const maxW = Math.min(AUTO_FIT_MAX_WIDTH, window.innerWidth * 0.8);
    const maxH = Math.min(AUTO_FIT_MAX_HEIGHT, window.innerHeight * 0.8);

    const width = Math.min(Math.max(naturalWidth, model.minSize.width), maxW);
    const height = Math.min(
      Math.max(naturalHeight, model.minSize.height),
      maxH,
    );

    model.updateSize({ width, height });

    const maxX = window.innerWidth - width - VIEWPORT_MARGIN;
    const maxY = window.innerHeight - height - VIEWPORT_MARGIN;
    const x = Math.max(VIEWPORT_MARGIN, Math.min(model.position.x, maxX));
    const y = Math.max(VIEWPORT_MARGIN, Math.min(model.position.y, maxY));
    if (x !== model.position.x || y !== model.position.y) {
      model.updatePosition({ x, y });
    }

    model.disableAutoSize();
  }, [
    model,
    model.autoSize,
    model.isDocked,
    model.isMaximized,
    contentRef,
    headerHeight,
  ]);
}
