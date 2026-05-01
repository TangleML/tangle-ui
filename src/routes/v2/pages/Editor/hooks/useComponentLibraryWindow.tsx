import { useEffect } from "react";

import { ComponentLibraryContent } from "@/routes/v2/pages/Editor/components/ComponentLibraryContent";
import { ComponentLibraryWindowMiniContent } from "@/routes/v2/pages/Editor/components/ComponentLibraryWindowMiniContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const COMPONENT_LIBRARY_WINDOW_ID = "component-library";

export function useComponentLibraryWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    const miniContent = <ComponentLibraryWindowMiniContent />;
    if (!windows.getWindowById(COMPONENT_LIBRARY_WINDOW_ID)) {
      windows.openWindow(<ComponentLibraryContent />, {
        id: COMPONENT_LIBRARY_WINDOW_ID,
        title: "Components",
        position: { x: 0, y: 100 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "left",
        miniContent,
      });
      return;
    }
    windows.setWindowMiniContent(COMPONENT_LIBRARY_WINDOW_ID, miniContent);
  }, [windows]);
}
