import { useStore } from "@xyflow/react";

import { ZOOM_THRESHOLD } from "@/routes/v2/shared/flowCanvasDefaults";

export const isDetailedZoom = (zoom: number) => zoom >= ZOOM_THRESHOLD;

const zoomSelector = (s: { transform: [number, number, number] }) =>
  isDetailedZoom(s.transform[2]);

/**
 * Returns true when the canvas is zoomed in enough to render the full,
 * detailed view of nodes and edges. When false, consumers should render
 * a simplified representation (larger text, fewer details, thicker edges).
 */
export function useIsDetailedView(): boolean {
  return useStore(zoomSelector);
}
