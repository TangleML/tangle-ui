import { useEffect } from "react";

export function useRunViewDocumentTitle(
  runId: string,
  pipelineName: string | undefined,
) {
  useEffect(() => {
    document.title = pipelineName
      ? `Tangle - ${pipelineName} - ${runId}`
      : `Tangle - ${runId}`;
  }, [runId, pipelineName]);
}
