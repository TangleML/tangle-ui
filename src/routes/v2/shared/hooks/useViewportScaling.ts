import type { Viewport } from "@xyflow/react";
import { useRef } from "react";

export function useViewportScaling() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleViewportChange = ({ zoom }: Viewport) => {
    containerRef.current?.style.setProperty("--zoom-level", String(zoom));
  };

  return { containerRef, handleViewportChange };
}
