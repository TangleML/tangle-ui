import { useEffect } from "react";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";

export function useTrackRecentlyViewedPipeline(
  pipelineName: string | null | undefined,
) {
  useEffect(() => {
    if (!pipelineName) return;

    addRecentlyViewed({
      type: "pipeline",
      id: pipelineName,
      name: pipelineName,
    });
  }, [pipelineName]);
}
