import { useEffect } from "react";

import { RunsAndSubmissionContent } from "@/routes/v2/pages/Editor/components/RunsAndSubmissionContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const RUNS_AND_SUBMISSION_WINDOW_ID = "runs-and-submission";

export function useRunsAndSubmissionWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(RUNS_AND_SUBMISSION_WINDOW_ID)) {
      windows.openWindow(<RunsAndSubmissionContent />, {
        id: RUNS_AND_SUBMISSION_WINDOW_ID,
        title: "Runs & Submissions",
        position: { x: 0, y: 460 },
        size: { width: 280, height: 320 },
        disabledActions: ["close"],
        persisted: true,
      });
    }
  }, [windows]);
}
