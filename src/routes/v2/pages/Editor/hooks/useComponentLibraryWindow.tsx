import { useEffect } from "react";

import { ComponentLibraryContent } from "@/routes/v2/pages/Editor/components/ComponentLibraryContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const COMPONENT_LIBRARY_WINDOW_ID = "component-library";

export function useComponentLibraryWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(COMPONENT_LIBRARY_WINDOW_ID)) {
      windows.openWindow(<ComponentLibraryContent />, {
        id: COMPONENT_LIBRARY_WINDOW_ID,
        title: "Components",
        position: { x: 0, y: 100 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
        persisted: true,
      });
    }
  }, [windows]);
}
