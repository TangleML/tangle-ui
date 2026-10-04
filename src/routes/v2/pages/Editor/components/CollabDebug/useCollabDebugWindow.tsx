import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

import { CollabDebugContent } from "./CollabDebugContent";

const COLLAB_DEBUG_WINDOW_ID = "collab-debug";

export function useCollabDebugWindow(active: boolean) {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!active) return;

    if (!windows.getWindowById(COLLAB_DEBUG_WINDOW_ID)) {
      windows.openWindow(<CollabDebugContent />, {
        id: COLLAB_DEBUG_WINDOW_ID,
        title: "Collaboration (PoC)",
        position: { x: window.innerWidth - 360, y: 80 },
        size: { width: 300, height: 460 },
        defaultDockState: "right",
        miniContent: (
          <WindowMiniButton
            tooltip="Collaboration debug"
            label="Collaboration"
            icon="Users"
          />
        ),
      });
    }

    return () => {
      windows.closeWindow(COLLAB_DEBUG_WINDOW_ID);
    };
  }, [windows, active]);
}
