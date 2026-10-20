import type { QueryClient } from "@tanstack/react-query";

import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";

export function invalidatePipelineQueries(
  queryClient: QueryClient,
  backendUrl: string,
) {
  for (const queryKey of [
    LocalPipelinesQueryKeys.All(),
    RemotePipelineQueryKeys.All(backendUrl),
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
