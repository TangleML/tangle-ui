import { reaction } from "mobx";
import { useEffect } from "react";

import { PipelineDetailsContent } from "@/routes/v2/pages/Editor/components/PipelineDetailsContent/PipelineDetailsContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const PIPELINE_DETAILS_WINDOW_ID = "pipeline-details";
const ROOT_TITLE = "Pipeline Details";
const SUBGRAPH_TITLE = "Subgraph Details";

export function usePipelineDetailsWindow() {
  const { windows, navigation } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(PIPELINE_DETAILS_WINDOW_ID)) {
      windows.openWindow(<PipelineDetailsContent />, {
        id: PIPELINE_DETAILS_WINDOW_ID,
        title: ROOT_TITLE,
        position: { x: 0, y: 460 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "right",
      });
    }

    return reaction(
      () => navigation.navigationDepth > 0,
      (isNested) => {
        const win = windows.getWindowById(PIPELINE_DETAILS_WINDOW_ID);
        win?.setTitle(isNested ? SUBGRAPH_TITLE : ROOT_TITLE);
      },
      { fireImmediately: true },
    );
  }, [windows, navigation]);
}
