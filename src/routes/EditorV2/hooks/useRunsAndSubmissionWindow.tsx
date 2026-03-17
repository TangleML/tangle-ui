import { useEffect } from "react";

import { RunsAndSubmissionContent } from "../components/RunsAndSubmissionContent";
import { getWindowById, openWindow } from "../windows/windows.actions";

const RUNS_AND_SUBMISSION_WINDOW_ID = "runs-and-submission";

export function useRunsAndSubmissionWindow() {
  useEffect(() => {
    if (!getWindowById(RUNS_AND_SUBMISSION_WINDOW_ID)) {
      openWindow(<RunsAndSubmissionContent />, {
        id: RUNS_AND_SUBMISSION_WINDOW_ID,
        title: "Runs & Submissions",
        position: { x: 0, y: 460 },
        size: { width: 280, height: 320 },
        disabledActions: ["close"],
      });
    }
  }, []);
}
