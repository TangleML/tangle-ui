import { useState } from "react";

import { useEmptyPipelineIds } from "@/routes/v2/pages/PipelineFolders/hooks/useEmptyPipelineIds";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

export interface EmptyPipelineFilter {
  hideEmpty: boolean;
  setHideEmpty: (hide: boolean) => void;
  apply: (candidates: PipelineFile[]) => PipelineFile[];
  hiddenCountIn: (candidates: PipelineFile[]) => number;
}

/**
 * Reading every pipeline to find the empty ones is only worth it where they
 * are the problem, so `enabled` is what keeps the folder page from paying for
 * the picker's filter.
 */
export function useEmptyPipelineFilter(
  pipelines: readonly PipelineFile[],
  enabled: boolean,
): EmptyPipelineFilter {
  const [hideEmpty, setHideEmpty] = useState(true);
  const emptyIds = useEmptyPipelineIds(enabled ? pipelines : []);

  return {
    hideEmpty,
    setHideEmpty,
    apply: (candidates) =>
      hideEmpty ? candidates.filter((p) => !emptyIds.has(p.id)) : candidates,
    hiddenCountIn: (candidates) =>
      hideEmpty ? candidates.filter((p) => emptyIds.has(p.id)).length : 0,
  };
}
