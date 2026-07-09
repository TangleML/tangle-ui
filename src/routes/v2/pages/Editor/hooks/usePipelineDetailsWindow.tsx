import { useEffect } from "react";

import { PipelineDetailsContent } from "@/routes/v2/pages/Editor/components/PipelineDetailsContent/PipelineDetailsContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const PIPELINE_DETAILS_WINDOW_ID = "pipeline-details";

export function usePipelineDetailsWindow() {
  const { windows, navigation } = useSharedStores();
  const isNestedSubgraph = navigation.navigationDepth > 0;
  const title = isNestedSubgraph ? "Subgraph Details" : "Pipeline Details";

  useEffect(() => {
    if (!windows.getWindowById(PIPELINE_DETAILS_WINDOW_ID)) {
      windows.openWindow(<PipelineDetailsContent />, {
        id: PIPELINE_DETAILS_WINDOW_ID,
        title,
        position: { x: 0, y: 460 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "right",
      });
    }
  }, [windows, title]);

  useEffect(() => {
    windows.getWindowById(PIPELINE_DETAILS_WINDOW_ID)?.setTitle(title);
  }, [windows, title]);
}
