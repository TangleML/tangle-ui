import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { getPipelineSpec, PipelineSpecApiError } from "./pipelineSpecService";
import { isSettledRefusal, MAX_QUERY_RETRIES } from "./retryPolicy";

function retryUnlessRefused(failureCount: number, error: Error) {
  if (error instanceof PipelineSpecApiError && isSettledRefusal(error.status)) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

export function usePipelineSpec(pipelineId: string | undefined | null) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ["pipelines", pipelineId ?? "", "spec"],
    queryFn: () => {
      if (!pipelineId) {
        throw new Error("Pipeline id is required");
      }
      return getPipelineSpec(pipelineId);
    },
    enabled: configured && available && Boolean(pipelineId),
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
    retry: retryUnlessRefused,
  });
}
