import { useEffect } from "react";

import { RunDetailsContent } from "@/routes/v2/pages/RunView/components/RunDetailsContent";
import { RunToolsContent } from "@/routes/v2/pages/RunView/components/RunToolsContent";
import {
  RUN_DETAILS_WINDOW_ID,
  RUN_TOOLS_WINDOW_ID,
} from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useRunViewWindows() {
  const { windows } = useSharedStores();
  useEffect(() => {
    windows.openWindow(<RunToolsContent />, {
      id: RUN_TOOLS_WINDOW_ID,
      title: "Run Tools",
      defaultVisible: true,
      disabledActions: ["close", "maximize"],
      size: { width: 280, height: 240 },
      position: { x: 0, y: 60 },
      minSize: { width: 240, height: 180 },
      defaultDockState: "left",
      persisted: true,
    });

    windows.openWindow(<RunDetailsContent />, {
      id: RUN_DETAILS_WINDOW_ID,
      title: "Run Details",
      defaultVisible: true,
      defaultDockState: "right",
      persisted: true,
    });
  }, [windows]);
}
