import { useQueries } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import { getRemotePipelineName } from "@/services/remotePipelinesService";
import { MINUTES } from "@/utils/constants";

import type { ProjectResourceSummary } from "./types";

const NAME_STALE_TIME = 1 * MINUTES;

/**
 * The name on a row is a copy taken when the pipeline was attached, and a
 * rename changes the pipeline, not the copy — so what a backend pipeline is
 * called now is looked up, keyed by row id. A row whose lookup has not
 * answered is left out, so the caller falls back to the copy.
 */
export function useRemotePipelineNames(
  resources: readonly ProjectResourceSummary[],
): ReadonlyMap<string, string> {
  const { backendUrl, configured, available } = useBackend();

  const rows = resources.flatMap((resource) =>
    resource.entity === "pipeline" && resource.entityId
      ? [{ resourceId: resource.id, pipelineId: resource.entityId }]
      : [],
  );

  const lookups = useQueries({
    queries: rows.map(({ pipelineId }) => ({
      queryKey: RemotePipelineQueryKeys.Name(backendUrl, pipelineId),
      queryFn: () => getRemotePipelineName(backendUrl, pipelineId),
      enabled: configured && available,
      staleTime: NAME_STALE_TIME,
      retry: false,
    })),
  });

  const currentNames = new Map<string, string>();
  rows.forEach(({ resourceId }, index) => {
    const name = lookups[index]?.data;
    if (name) currentNames.set(resourceId, name);
  });
  return currentNames;
}
