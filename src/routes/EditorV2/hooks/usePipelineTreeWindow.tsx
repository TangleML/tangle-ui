import { useEffect } from "react";

import { PipelineTreeContent } from "@/routes/EditorV2/components/PipelineTreeContent/PipelineTreeContent";
import { getWindowById, openWindow } from "@/routes/EditorV2/windows/windows.actions";

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
