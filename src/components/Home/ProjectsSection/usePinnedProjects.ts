import { useQueries } from "@tanstack/react-query";

import { useFavorites } from "@/hooks/useFavorites";
import { useBackend } from "@/providers/BackendProvider";
import { getProject } from "@/services/projects/projectsService";
import type { ProjectSummary } from "@/services/projects/types";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { MINUTES } from "@/utils/constants";

interface PinnedProjects {
  projects: ProjectSummary[];
  isPending: boolean;
}

/**
 * The projects this browser has pinned, in the order they were pinned.
 *
 * Pinning is the only way to keep hold of a project someone shared: the
 * projects list asks the backend for the ones the caller created, and the
 * backend has no notion of who a project was shared with. So the record is
 * local, and this is the one seam to replace if it ever grows a server side —
 * nothing above it knows where the list came from.
 */
export function usePinnedProjects(): PinnedProjects {
  const { configured, available } = useBackend();
  const { favorites } = useFavorites();

  const ids = favorites
    .filter((item) => item.type === "project")
    .map((item) => item.id);

  const enabled = configured && available;

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ProjectsQueryKeys.Id(id),
      queryFn: () => getProject(id),
      enabled,
      // A project that has been deleted, or that this caller cannot reach, is
      // simply dropped — retrying would not bring it back.
      retry: false,
      staleTime: 5 * MINUTES,
      refetchOnWindowFocus: false,
    })),
  });

  return {
    projects: enabled ? results.flatMap((result) => result.data ?? []) : [],
    isPending: enabled && results.some((result) => result.isPending),
  };
}
