import { useEffect } from "react";

import type { CanvasOverlayConfig } from "@/routes/v2/shared/store/canvasOverlay.types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Activates a canvas overlay while the config is non-null,
 * and auto-deactivates it on unmount or when the config changes.
 */
export function useCanvasOverlay(config: CanvasOverlayConfig | null) {
  const { canvasOverlay } = useSharedStores();

  useEffect(() => {
    if (config) {
      canvasOverlay.activate(config);
    }
    return () => {
      if (config) {
        canvasOverlay.deactivateById(config.id);
      }
    };
  }, [config, canvasOverlay]);
}
