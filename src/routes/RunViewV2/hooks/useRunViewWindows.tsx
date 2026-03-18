import { useEffect } from "react";

import {
  closeWindow,
  dockWindow,
  openWindow,
} from "../../EditorV2/windows/windows.actions";
import { RunDetailsContent } from "../components/RunDetailsContent";
import { RunToolsContent } from "../components/RunToolsContent";

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
    });

    openWindow(<RunDetailsContent />, {
      id: RUN_DETAILS_WINDOW_ID,
      title: "Run Details",
      startVisible: true,
    });
    dockWindow(RUN_DETAILS_WINDOW_ID, "right");

    return () => {
      closeWindow(RUN_TOOLS_WINDOW_ID);
      closeWindow(RUN_DETAILS_WINDOW_ID);
    };
  }, []);
}
