import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { getRunExecutionStats, listProjectRuns } from "./projectRunsService";
import { ProjectRunsQueryKeys } from "./types";

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
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

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
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}
