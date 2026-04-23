import { useEffect } from "react";

import { PipelineTreeContent } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/PipelineTreeContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const PIPELINE_TREE_WINDOW_ID = "pipeline-tree";

export function usePipelineTreeWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(PIPELINE_TREE_WINDOW_ID)) {
      windows.openWindow(<PipelineTreeContent />, {
        id: PIPELINE_TREE_WINDOW_ID,
        title: "Pipeline Structure",
        position: { x: 300, y: 100 },
        size: { width: 280, height: 400 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "left",
      });
    }
  }, [windows]);
}
