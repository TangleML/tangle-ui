import { useEffect } from "react";

import { ComponentLibraryContent } from "../components/ComponentLibraryContent";
import { getWindowById, openWindow } from "../windows/windows.actions";

const COMPONENT_LIBRARY_WINDOW_ID = "component-library";

export function useComponentLibraryWindow() {
  useEffect(() => {
    if (!getWindowById(COMPONENT_LIBRARY_WINDOW_ID)) {
      openWindow(<ComponentLibraryContent />, {
        id: COMPONENT_LIBRARY_WINDOW_ID,
        title: "Components",
        position: { x: 0, y: 100 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
      });
    }
  }, []);
}
