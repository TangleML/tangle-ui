import { useQueries, useQuery } from "@tanstack/react-query";

import { useFavorites } from "@/hooks/useFavorites";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { getProject } from "@/services/projects/projectsService";
import type { ProjectSummary } from "@/services/projects/types";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { MINUTES } from "@/utils/constants";

const UNRESOLVED_USER_ID = "Unknown";

const MAX_SHARED = 12;

interface SharedProjects {
  projects: ProjectSummary[];
  isPending: boolean;
}

/**
 * Projects this browser has been in that the caller did not create — the ones a
 * shared link led to. The backend has no notion of who a project was shared
 * with, so the record is local: starred projects first, because starring is a
 * decision to keep one, then the visits, which age out.
 *
 * The one seam to replace if the backend ever tracks membership; nothing above
 * it knows where the list came from.
 */
export function useSharedProjects(): SharedProjects {
  const { configured, available } = useBackend();
  const { data: user, isPending: isUserPending } = useQuery(userQueryOptions);
  const { favorites } = useFavorites();
  const { recentlyViewed } = useRecentlyViewed();

  const isUserResolved = Boolean(user) && user?.id !== UNRESOLVED_USER_ID;

  const projectIds = (items: readonly { type: string; id: string }[]) =>
    items.filter((item) => item.type === "project").map((item) => item.id);

  const ids = [
    ...new Set([...projectIds(favorites), ...projectIds(recentlyViewed)]),
  ].slice(0, MAX_SHARED);

  // Without a resolved caller there is nobody to be "not the creator" of, and
  // `useMyProjects` is listing everyone's projects in that state anyway, so a
  // second section would only repeat it.
  const enabled = configured && available && isUserResolved;

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

  const projects = results.flatMap((result) =>
    result.data && result.data.createdBy !== user?.id ? result.data : [],
  );

  return {
    projects: enabled ? projects : [],
    isPending: isUserPending || (enabled && results.some((r) => r.isPending)),
  };
}
