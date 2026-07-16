import { useEffect } from "react";

import { PipelineDetailsContent } from "@/routes/v2/pages/Editor/components/PipelineDetailsContent/PipelineDetailsContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

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
        miniContent: (
          <WindowMiniButton
            tooltip="View Pipeline Details"
            label="Pipeline Details"
            icon="Info"
          />
        ),
      });
    }
  }, [windows, title]);

  useEffect(() => {
    windows.getWindowById(PIPELINE_DETAILS_WINDOW_ID)?.setTitle(title);
  }, [windows, title]);
}
