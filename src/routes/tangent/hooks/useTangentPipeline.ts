import { useQuery } from "@tanstack/react-query";

import { fetchTangentPipeline } from "@/routes/tangent/services/tangentApi";
import { TangentQueryKeys } from "@/routes/tangent/types";
import { MINUTES } from "@/utils/constants";

export function useTangentPipeline(runId: string) {
  return useQuery({
    queryKey: TangentQueryKeys.Pipeline(runId),
    queryFn: () => fetchTangentPipeline(runId),
    enabled: runId.length > 0,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}
