import { useEffect } from "react";

import { PipelineTreeContent } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/PipelineTreeContent";
import { PipelineTreeWindowMiniContent } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/PipelineTreeWindowMiniContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const PIPELINE_TREE_WINDOW_ID = "pipeline-tree";

export function usePipelineTreeWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    const miniContent = <PipelineTreeWindowMiniContent />;
    if (!windows.getWindowById(PIPELINE_TREE_WINDOW_ID)) {
      windows.openWindow(<PipelineTreeContent />, {
        id: PIPELINE_TREE_WINDOW_ID,
        title: "Pipeline Structure",
        position: { x: 300, y: 100 },
        size: { width: 280, height: 400 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "left",
        miniContent,
      });
      return;
    }
    windows.setWindowMiniContent(PIPELINE_TREE_WINDOW_ID, miniContent);
  }, [windows]);
}
