import { useEffect } from "react";

import { RunDetailsContent } from "@/routes/v2/pages/RunView/components/RunDetailsContent";
import { RunToolsContent } from "@/routes/v2/pages/RunView/components/RunToolsContent";
import { openWindow } from "@/routes/v2/shared/windows/windows.actions";

const RUN_TOOLS_WINDOW_ID = "run-tools";
const RUN_DETAILS_WINDOW_ID = "run-details";

export function useRunViewWindows() {
  useEffect(() => {
    openWindow(<RunToolsContent />, {
      id: RUN_TOOLS_WINDOW_ID,
      title: "Run Tools",
      startVisible: true,
      disabledActions: ["close", "maximize"],
      size: { width: 400, height: 80 },
      position: { x: 0, y: 60 },
      minSize: { width: 400, height: 80 },
      persisted: true,
    });

    openWindow(<RunDetailsContent />, {
      id: RUN_DETAILS_WINDOW_ID,
      title: "Run Details",
      startVisible: true,
      persisted: true,
    });
  }, []);
}
