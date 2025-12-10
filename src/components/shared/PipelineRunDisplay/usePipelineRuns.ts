import { useSuspenseQuery } from "@tanstack/react-query";

import { fetchPipelineRuns } from "@/services/pipelineRunService";
import { MINUTES } from "@/utils/constants";

export function usePipelineRuns(pipelineName?: string) {
  return useSuspenseQuery({
    queryKey: ["pipelineRuns", pipelineName],
    queryFn: async () => {
      if (!pipelineName) return [];

      const res = await fetchPipelineRuns(pipelineName);

      if (!res) return [];

      return res.runs;
    },
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
