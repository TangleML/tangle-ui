import type { Viewport } from "@xyflow/react";
import { useRef } from "react";

import {
  MAX_COLLAPSED_SCALE,
  ZOOM_THRESHOLD,
} from "@/routes/v2/shared/flowCanvasDefaults";

export function useViewportScaling() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleViewportChange = ({ zoom }: Viewport) => {
    const scale = Math.min(ZOOM_THRESHOLD / zoom, MAX_COLLAPSED_SCALE);
    containerRef.current?.style.setProperty(
      "--simplified-scale",
      String(scale),
    );
    containerRef.current?.style.setProperty("--zoom-level", String(zoom));
  };

  return { containerRef, handleViewportChange };
}
