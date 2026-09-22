import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { listProjects } from "@/services/projects/projectsService";
import type { ProjectSummary } from "@/services/projects/types";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { MINUTES } from "@/utils/constants";

const UNRESOLVED_USER_ID = "Unknown";

const PAGE_SIZE = 24;

interface MyProjects {
  projects: ProjectSummary[];
  totalCount: number;
  isPending: boolean;
  error: Error | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

/**
 * The projects page and the dashboard's preview ask the same question, so they
 * ask it through one hook and share the answer rather than paging the list two
 * ways under two cache keys.
 */
export function useMyProjects(): MyProjects {
  const { configured, available } = useBackend();
  const { data: user, isPending: isUserPending } = useQuery(userQueryOptions);
  const createdBy = user?.id === UNRESOLVED_USER_ID ? undefined : user?.id;

  const {
    data,
    isPending,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ProjectsQueryKeys.List({ createdBy, pageSize: PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      listProjects({ createdBy, pageSize: PAGE_SIZE, pageToken: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextPageToken ?? undefined,
    // Asking before the user resolves would fetch everyone's projects first
    // and the caller's a moment later, under two different cache keys.
    enabled: configured && available && !isUserPending,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });

  return {
    projects: data?.pages.flatMap((page) => page.items) ?? [],
    totalCount: data?.pages[0]?.totalCount ?? 0,
    isPending: isUserPending || isPending,
    error,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  };
}
