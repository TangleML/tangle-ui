import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { CanvasControlsContent } from "./CanvasControlsContent";

const CANVAS_CONTROLS_WINDOW_ID = "canvas-controls";
const CANVAS_CONTROLS_WINDOW_HEIGHT = 150;
const WINDOW_CHROME_HEIGHT = 30;

export function useCanvasControlsWindow(trackingSpace: string) {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(CANVAS_CONTROLS_WINDOW_ID)) {
      windows.openWindow(
        <CanvasControlsContent trackingSpace={trackingSpace} />,
        {
          id: CANVAS_CONTROLS_WINDOW_ID,
          title: "Minimap",
          position: {
            x: 320,
            y:
              window.innerHeight -
              CANVAS_CONTROLS_WINDOW_HEIGHT -
              WINDOW_CHROME_HEIGHT,
          },
          size: { width: 226, height: CANVAS_CONTROLS_WINDOW_HEIGHT },
          minSize: { width: 226, height: CANVAS_CONTROLS_WINDOW_HEIGHT },
          disabledActions: ["close", "maximize"],
          variant: "panel",
          persisted: true,
        },
      );
    }
  }, [windows]);
}
