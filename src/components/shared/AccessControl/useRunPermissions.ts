import { useQuery } from "@tanstack/react-query";

import type { PipelineRunResponse } from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import { getAnnotationValue } from "@/utils/annotations";

import { getMyScopes, PIPELINE_ID_ANNOTATION } from "./accessControlApi";

export function useRunPipelineId(
  runId: string | number | undefined,
): string | undefined {
  const { backendUrl } = useBackend();
  const { data: annotations } = useQuery({
    ...runAnnotationsQueryOptions(runId, backendUrl),
  });
  return getAnnotationValue(annotations, PIPELINE_ID_ANNOTATION) || undefined;
}

export function useRunPermissions(
  metadata: PipelineRunResponse | undefined,
  currentUserId: string | undefined,
) {
  const isRunCreator =
    !!currentUserId && metadata?.created_by === currentUserId;
  const runId = metadata?.id;
  const pipelineId = useRunPipelineId(runId);

  const { data: scopes = [] } = useQuery({
    queryKey: ["access_control", "pipeline_run", runId, "my_scopes"],
    queryFn: () => getMyScopes("pipeline_run", String(runId)),
    enabled: !!runId && !isRunCreator && !!pipelineId,
    retry: false,
    staleTime: 60_000,
  });

  return {
    canCancel: isRunCreator || scopes.includes("run:cancel"),
    canAnnotate: isRunCreator || scopes.includes("run:annotate"),
  };
}
