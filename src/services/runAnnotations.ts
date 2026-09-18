import { queryOptions } from "@tanstack/react-query";

import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import { fetchRunAnnotations } from "./pipelineRunService";

const runAnnotationsQueryKey = (runId: string) =>
  ["pipeline-run-annotations", runId] as const;

/**
 * A run's id reaches this from several places as either a string or a number,
 * which cached the same run's annotations twice under keys that never met.
 */
export function runAnnotationsQueryOptions(
  runId: string | number | undefined,
  backendUrl: string,
) {
  const id = runId === undefined ? "" : String(runId);

  return queryOptions({
    queryKey: runAnnotationsQueryKey(id),
    queryFn: () => fetchRunAnnotations(id, backendUrl),
    enabled: id !== "",
    refetchOnWindowFocus: false,
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
  });
}
