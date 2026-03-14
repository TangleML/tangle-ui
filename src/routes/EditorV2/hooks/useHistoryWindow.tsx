import { useEffect } from "react";

import { HistoryContent } from "../components/HistoryContent";
import { getWindowById, openWindow } from "../windows/windows.actions";

const HISTORY_WINDOW_ID = "history";

export function useHistoryWindow() {
  useEffect(() => {
    if (!getWindowById(HISTORY_WINDOW_ID)) {
      openWindow(<HistoryContent />, {
        id: HISTORY_WINDOW_ID,
        title: "History",
        position: { x: window.innerWidth - 620, y: 80 },
        size: { width: 260, height: 350 },
        disabledActions: ["close"],
      });
    }
  }, []);
}
