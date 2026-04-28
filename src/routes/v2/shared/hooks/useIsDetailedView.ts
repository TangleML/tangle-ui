import { useStore } from "@xyflow/react";

import { ZOOM_THRESHOLD } from "@/routes/v2/shared/flowCanvasDefaults";

const zoomSelector = (s: { transform: [number, number, number] }) =>
  s.transform[2] >= ZOOM_THRESHOLD;

/**
 * Returns true when the canvas is zoomed in enough to render the full,
 * detailed view of nodes and edges. When false, consumers should render
 * a simplified representation (larger text, fewer details, thicker edges).
 */
export function useIsDetailedView(): boolean {
  return useStore(zoomSelector);
}
