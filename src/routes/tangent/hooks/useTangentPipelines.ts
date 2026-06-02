import { useQuery } from "@tanstack/react-query";

import { fetchTangentPipelines } from "@/routes/tangent/services/tangentApi";
import { TangentQueryKeys } from "@/routes/tangent/types";
import { MINUTES } from "@/utils/constants";

export function useTangentPipelines() {
  return useQuery({
    queryKey: TangentQueryKeys.Pipelines(),
    queryFn: fetchTangentPipelines,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}
