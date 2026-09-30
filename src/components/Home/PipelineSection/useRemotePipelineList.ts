import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { usePagination } from "@/hooks/usePagination";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import type { PipelineSearchFilters } from "@/types/pipelineSearch";
import { ONE_MINUTE_IN_MS } from "@/utils/constants";
import { subscribeUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import {
  filterPipelineEntries,
  type PipelineEntry,
} from "./usePipelineFilters";
import type { PipelineListEntry } from "./usePipelineList";
import { useRemotePipelineSearch } from "./useRemotePipelineSearch";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

function toRows(
  files: PipelineFile[] = [],
  searchQuery = "",
): PipelineEntry<PipelineListEntry>[] {
  return files.map((file) => [
    file.id,
    {
      name: file.displayName,
      modificationTime: file.modifiedAt,
      file,
    },
    {
      searchQuery,
      matchedFields: [],
      componentQuery: "",
      matchedComponentNames: [],
    },
  ]);
}

export function useRemotePipelineList() {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const search = useRemotePipelineSearch();
  const { searchQuery, userId, dateRange, annotations } = search;
  const requestedFilterKey = JSON.stringify(search.filters);
  const [filters, setFilters] = useState<PipelineSearchFilters>(search.filters);
  const filterKey = JSON.stringify(filters);
  const pageScope = JSON.stringify([storage.scope, filterKey]);
  const [position, setPosition] = useState({ scope: pageScope, index: 0 });
  const navigationVersion = useRef(0);
  const pageIndex = position.scope === pageScope ? position.index : 0;
  const queryKey = [...FoldersQueryKeys.All(), "remote-list", storage.scope];

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(JSON.parse(requestedFilterKey));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [requestedFilterKey]);

  useEffect(() => {
    navigationVersion.current += 1;
    setPosition({ scope: pageScope, index: 0 });
  }, [pageScope]);

  const resetPage = () => {
    navigationVersion.current += 1;
    setPosition({ scope: pageScope, index: 0 });
  };
  const pages = useInfiniteQuery({
    queryKey: [...queryKey, "pages", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      storage.listRemotePipelinePage({
        pageSize: PAGE_SIZE,
        pageToken: pageParam,
        filters,
        signal,
      }),
    getNextPageParam: (lastPage, _allPages, lastParam, allParams) => {
      const next = lastPage.nextPageToken;
      return next && next !== lastParam && !allParams.includes(next)
        ? next
        : undefined;
    },
    enabled: storage.remoteEnabled,
    staleTime: 5 * ONE_MINUTE_IN_MS,
    refetchOnWindowFocus: false,
  });
  // Recovery copies only represent the current user's unfiltered collection.
  const showingCached =
    !!pages.error &&
    !pages.data &&
    !filters.searchQuery &&
    !filters.modifiedAfter &&
    !filters.modifiedBefore &&
    !filters.annotations?.length &&
    filters.userId === "me";
  const cached = useQuery({
    queryKey: [...queryKey, "cached"],
    queryFn: () => storage.listCachedPipelines(),
    enabled: storage.remoteEnabled && showingCached,
  });
  useEffect(() => subscribeUserPipelineWritten(resetPage), [pageScope]);
  const safePageIndex = Math.min(
    pageIndex,
    Math.max(0, (pages.data?.pages.length ?? 1) - 1),
  );
  const page = pages.data?.pages[safePageIndex];
  const cachedRows = filterPipelineEntries(
    new Map(toRows(cached.data).map(([id, entry]) => [id, entry])),
    {
      searchQuery: "",
      componentQuery: "",
      dateRange: undefined,
      sortField: filters.sortField === "name" ? "name" : "modified_at",
      sortDirection: filters.sortDirection ?? "desc",
    },
  );
  const cachedPagination = usePagination(cachedRows, PAGE_SIZE, pageScope);
  const totalCount = showingCached
    ? (cached.data?.length ?? 0)
    : (pages.data?.pages[0]?.totalCount ??
      pages.data?.pages.flatMap((page) => page.files).length ??
      0);
  const loadedPageCount = pages.data?.pages.length ?? 0;
  const hasRemotePipelines = pages.data
    ? !!(
        pages.data.pages[0]?.files.length || pages.data.pages[0]?.nextPageToken
      )
    : undefined;
  const cursorPagination = {
    currentPage: safePageIndex + 1,
    totalPages: Math.max(
      Math.ceil(totalCount / PAGE_SIZE),
      loadedPageCount + (pages.hasNextPage ? 1 : 0),
    ),
    hasNextPage:
      !pages.isFetching &&
      (safePageIndex + 1 < loadedPageCount || pages.hasNextPage),
    hasPreviousPage: safePageIndex > 0,
    goToNextPage: async () => {
      if (safePageIndex + 1 < loadedPageCount) {
        setPosition({ scope: pageScope, index: safePageIndex + 1 });
        return;
      }
      if (!pages.hasNextPage || pages.isFetching) return;
      const version = navigationVersion.current;
      const result = await pages.fetchNextPage();
      if (
        version === navigationVersion.current &&
        (result.data?.pages.length ?? 0) > safePageIndex + 1
      )
        setPosition({ scope: pageScope, index: safePageIndex + 1 });
    },
    goToPreviousPage: () => {
      navigationVersion.current += 1;
      setPosition({ scope: pageScope, index: Math.max(0, safePageIndex - 1) });
    },
    resetPage,
  };
  const pagination = showingCached ? cachedPagination : cursorPagination;
  const refresh = async () => {
    resetPage();
    cachedPagination.resetPage();
    await queryClient.resetQueries({ queryKey });
  };
  const rows = showingCached
    ? cachedPagination.paginatedItems
    : toRows(page?.files, filters.searchQuery);
  const isPending = pages.isPending || (showingCached && cached.isPending);
  return {
    rows,
    ...search,
    filterKey,
    hasSearchFilters:
      !!searchQuery.trim() ||
      userId.trim() !== "me" ||
      !!dateRange?.from ||
      !!dateRange?.to ||
      annotations.length > 0,
    pagination,
    isPending,
    isFetching: pages.isFetching,
    error: pages.error?.message,
    showingCached,
    hasRemotePipelines,
    totalCount,
    resultCount: isPending ? undefined : rows.length,
    hasMoreResults:
      !showingCached &&
      pages.data?.pages[0]?.totalCount === undefined &&
      pages.hasNextPage,
    refresh,
  };
}
