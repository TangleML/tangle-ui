import { useEffect } from "react";

import { RunDetailsContent } from "@/routes/v2/pages/RunView/components/RunDetailsContent";
import { RunToolsContent } from "@/routes/v2/pages/RunView/components/RunToolsContent";
import {
  RUN_DETAILS_WINDOW_ID,
  RUN_TOOLS_WINDOW_ID,
} from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

export function useRunViewWindows() {
  const { windows } = useSharedStores();
  useEffect(() => {
    // Guard each openWindow: calling it for an existing window restores it if
    // hidden (see focusExistingWindow), which would un-hide a window the user
    // deliberately hid whenever this effect re-runs (StrictMode double-invoke,
    // remount on run/subgraph navigation). Only open when absent.
    if (!windows.getWindowById(RUN_TOOLS_WINDOW_ID)) {
      windows.openWindow(<RunToolsContent />, {
        id: RUN_TOOLS_WINDOW_ID,
        title: "Run Tools",
        defaultVisible: true,
        disabledActions: ["close", "maximize"],
        variant: "panel",
        size: { width: 280, height: 240 },
        position: { x: 0, y: 60 },
        minSize: { width: 240, height: 180 },
        defaultDockState: "left",
        persisted: true,
        miniContent: (
          <WindowMiniButton
            tooltip="View Run Tools"
            label="Run Tools"
            icon="Wrench"
          />
        ),
      });
    }

    if (!windows.getWindowById(RUN_DETAILS_WINDOW_ID)) {
      windows.openWindow(<RunDetailsContent />, {
        id: RUN_DETAILS_WINDOW_ID,
        title: "Run Details",
        defaultVisible: true,
        defaultDockState: "right",
        persisted: true,
        miniContent: (
          <WindowMiniButton
            tooltip="View Run Details"
            label="Run Details"
            icon="Info"
          />
        ),
      });
    }
  }, [windows]);
}
