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
  createdBy: string | undefined;
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
  const {
    data: user,
    isPending: isUserPending,
    error: userError,
  } = useQuery(userQueryOptions);

  // A backend that does not identify anyone answers `Unknown`, and every
  // reader of this query treats that as nobody to filter by rather than as a
  // failure — on a single-user backend the unfiltered list is that user's. A
  // lookup that did not answer at all is the failure, and is reported: there
  // the list would be everyone's without anything saying so.
  const createdBy = user && user.id !== UNRESOLVED_USER_ID ? user.id : undefined;
  const isIdentified = user !== undefined;

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
    enabled: configured && available && isIdentified,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });

  return {
    projects: data?.pages.flatMap((page) => page.items) ?? [],
    createdBy,
    totalCount: data?.pages[0]?.totalCount ?? 0,
    isPending: isUserPending || (userError === null && isPending),
    error: userError ?? error,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  };
}
