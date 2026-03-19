import { useEffect } from "react";

import { PipelineDetailsContent } from "@/routes/v2/pages/Editor/components/PipelineDetailsContent/PipelineDetailsContent";
import {
  dockWindow,
  getWindowById,
  openWindow,
} from "@/routes/v2/shared/windows/windows.actions";

const PIPELINE_DETAILS_WINDOW_ID = "pipeline-details";

export function usePipelineDetailsWindow() {
  useEffect(() => {
    if (!getWindowById(PIPELINE_DETAILS_WINDOW_ID)) {
      openWindow(<PipelineDetailsContent />, {
        id: PIPELINE_DETAILS_WINDOW_ID,
        title: "Pipeline Details",
        position: { x: 0, y: 460 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
      });
      dockWindow(PIPELINE_DETAILS_WINDOW_ID, "right");
    }
  }, []);
}
