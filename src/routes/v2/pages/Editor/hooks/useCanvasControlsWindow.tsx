import { useEffect } from "react";

import { CanvasControlsContent } from "@/routes/v2/pages/Editor/components/CanvasControls/CanvasControlsContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const CANVAS_CONTROLS_WINDOW_ID = "canvas-controls";

export function useCanvasControlsWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(CANVAS_CONTROLS_WINDOW_ID)) {
      windows.openWindow(<CanvasControlsContent />, {
        id: CANVAS_CONTROLS_WINDOW_ID,
        title: "Canvas Controls",
        position: { x: 320, y: window.innerHeight - 109 },
        size: { width: 226, height: 109 },
        minSize: { width: 226, height: 109 },
        disabledActions: ["close", "maximize"],
        persisted: true,
      });
    }
  }, [windows]);
}
