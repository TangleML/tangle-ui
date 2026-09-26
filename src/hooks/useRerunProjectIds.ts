import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { useBackend } from "@/providers/BackendProvider";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";

/**
 * Read at the moment of rerun rather than on render: a click that beat the read
 * would submit the copy into no project, and a run's projects cannot be set
 * afterwards. For the same reason the read is allowed to fail the rerun —
 * losing attribution is permanent, where a refused rerun can be done again.
 */
export function useRerunProjectIds() {
  const queryClient = useQueryClient();
  const { backendUrl } = useBackend();

  return useCallback(
    async (runId: string | number | null | undefined): Promise<string[]> => {
      if (runId == null || !isFlagEnabled("projects")) {
        return [];
      }

      const annotations = await queryClient.fetchQuery(
        runAnnotationsQueryOptions(runId, backendUrl),
      );
      return projectIdsFromAnnotations(annotations);
    },
    [backendUrl, queryClient],
  );
}
