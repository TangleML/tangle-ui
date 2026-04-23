import { useEffect } from "react";

import { HistoryContent } from "@/routes/v2/pages/Editor/components/HistoryContent/HistoryContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const HISTORY_WINDOW_ID = "history";

export function useHistoryWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(HISTORY_WINDOW_ID)) {
      windows.openWindow(<HistoryContent />, {
        id: HISTORY_WINDOW_ID,
        title: "History",
        position: { x: window.innerWidth - 620, y: 80 },
        size: { width: 260, height: 350 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "left",
      });
    }
  }, [windows]);
}
