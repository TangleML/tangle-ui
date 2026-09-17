import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { listProjectRuns } from "./projectRunsService";
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
