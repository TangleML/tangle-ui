import type { QueryClient } from "@tanstack/react-query";

import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";

export function invalidatePipelineQueries(
  queryClient: QueryClient,
  backendUrl: string,
) {
  for (const queryKey of [
    LocalPipelinesQueryKeys.All(),
    ["remote-pipelines-page", backendUrl],
    ["remote-pipelines", backendUrl],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
