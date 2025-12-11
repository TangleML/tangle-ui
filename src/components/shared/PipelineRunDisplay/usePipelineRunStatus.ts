import { useSuspenseQuery } from "@tanstack/react-query";

import { fetchExecutionStatusLight } from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import { MINUTES } from "@/utils/constants";

/**
 *
 * @param run - The pipeline run to fetch the status for
 * @returns
 */
export function usePipelineRunStatus(run: PipelineRun) {
  return useSuspenseQuery({
    queryKey: ["runStatus", run.root_execution_id],
    queryFn: async () => {
      if (run.status) return run.status;
      return await fetchExecutionStatusLight(run.root_execution_id.toString());
    },
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
