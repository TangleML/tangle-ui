import { useEffect } from "react";

import { PipelineTreeContent } from "../components/PipelineTreeContent";
import { getWindowById, openWindow } from "../windows/windowStore";

export const PIPELINE_TREE_WINDOW_ID = "pipeline-tree";

export function usePipelineTreeWindow() {
  useEffect(() => {
    if (!getWindowById(PIPELINE_TREE_WINDOW_ID)) {
      openWindow(<PipelineTreeContent />, {
        id: PIPELINE_TREE_WINDOW_ID,
        title: "Pipeline Structure",
        position: { x: 300, y: 100 },
        size: { width: 280, height: 400 },
        disabledActions: ["close"],
      });
    }
  }, []);
}
