import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import {
  type ExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

import { getRunExecutionStats, listProjectRuns } from "./projectRunsService";
import { projectQueryDefaults } from "./queryDefaults";
import { ProjectRunsQueryKeys } from "./types";

const RUN_POLL_MS = 5000;

/**
 * A run with no executions yet has not started rather than finished, so it
 * keeps polling: that is the "Waiting for upstream" a queued run sits in.
 */
export function runPollInterval(
  stats: ExecutionStatusStats | null | undefined,
): number | false {
  return stats && isExecutionComplete(stats) ? false : RUN_POLL_MS;
}

export function useProjectRuns(projectId: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectRunsQueryKeys.List(projectId ?? ""),
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project id is required");
      }
      return listProjectRuns(projectId);
    },
    enabled: configured && available && Boolean(projectId),
    ...projectQueryDefaults,
  });
}

/**
 * A run's status changes on the backend with nothing to tell this page, so it
 * is polled until the run reaches a terminal state and then left alone.
 *
 * The shared five-minute `staleTime` is overridden for the same reason: left
 * alone it serves a settled status to the next mount, which is how a completed
 * run came back still claiming to be waiting.
 */
export function useRunExecutionStats(runId: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectRunsQueryKeys.Stats(runId ?? ""),
    queryFn: () => {
      if (!runId) {
        throw new Error("Run id is required");
      }
      return getRunExecutionStats(runId);
    },
    enabled: configured && available && Boolean(runId),
    ...projectQueryDefaults,
    staleTime: RUN_POLL_MS,
    refetchInterval: ({ state }) => runPollInterval(state.data),
  });
}
