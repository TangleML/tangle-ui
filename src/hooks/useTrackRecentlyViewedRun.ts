import { useEffect } from "react";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";

export function useTrackRecentlyViewedRun(
  runId: string | null | undefined,
  pipelineName: string | null | undefined,
) {
  useEffect(() => {
    if (!runId || !pipelineName) return;

    addRecentlyViewed({
      type: "run",
      id: runId,
      name: pipelineName,
    });
  }, [runId, pipelineName]);
}
