import { useEffect } from "react";

import { RecentRunsContent } from "@/routes/v2/pages/Editor/components/RecentRunsContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const RECENT_RUNS_WINDOW_ID = "recent-runs";

export function useRecentRunsWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(RECENT_RUNS_WINDOW_ID)) {
      windows.openWindow(<RecentRunsContent />, {
        id: RECENT_RUNS_WINDOW_ID,
        title: "Recent Runs",
        position: { x: 0, y: 460 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "left",
      });
    }
  }, [windows]);
}
