import { useQuery } from "@tanstack/react-query";

import { fetchTangentStats } from "@/routes/tangent/services/tangentApi";
import { TangentQueryKeys } from "@/routes/tangent/types";
import { MINUTES } from "@/utils/constants";

export function useTangentStats() {
  return useQuery({
    queryKey: TangentQueryKeys.Stats(),
    queryFn: fetchTangentStats,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}
