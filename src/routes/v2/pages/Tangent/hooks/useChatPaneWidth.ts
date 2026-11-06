import { useEffect, useRef, useState } from "react";

import {
  MAX_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  MIN_WORKAREA_WIDTH,
} from "@/routes/v2/pages/Tangent/layout";

const UNMEASURED = 0;

export function chatWidthCeiling(rowWidth: number, dockWidth: number): number {
  if (rowWidth === UNMEASURED) return MAX_CHAT_WIDTH;
  const spare = rowWidth - dockWidth - MIN_WORKAREA_WIDTH;
  return Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, spare));
}

export function useChatPaneWidth(dockWidth: number) {
  const rowRef = useRef<HTMLElement | null>(null);
  const [rowWidth, setRowWidth] = useState(UNMEASURED);
  // Starts as wide as it can go; the ceiling still leaves the canvas its room.
  const [requestedWidth, setRequestedWidth] = useState(MAX_CHAT_WIDTH);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const observer = new ResizeObserver(([entry]) => {
      setRowWidth(entry.contentRect.width);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const maxWidth = chatWidthCeiling(rowWidth, dockWidth);

  return {
    rowRef,
    maxWidth,
    width: Math.min(requestedWidth, maxWidth),
    requestWidth: (attempted: number) =>
      setRequestedWidth(
        Math.max(MIN_CHAT_WIDTH, Math.min(maxWidth, attempted)),
      ),
  };
}
