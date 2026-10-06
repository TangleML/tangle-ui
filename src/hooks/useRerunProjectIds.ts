import { useQueryClient } from "@tanstack/react-query";

import { isProjectsEnabled } from "@/components/shared/Settings/useFlags";
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

  return async (runId: string | number | null | undefined) => {
    if (runId == null || !isProjectsEnabled()) {
      return [];
    }

    const annotations = await queryClient.fetchQuery(
      runAnnotationsQueryOptions(runId, backendUrl),
    );
    return projectIdsFromAnnotations(annotations);
  };
}
