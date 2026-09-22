import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { usePagination } from "@/hooks/usePagination";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import { ONE_MINUTE_IN_MS } from "@/utils/constants";
import { subscribeUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import type { PipelineEntry } from "./usePipelineFilters";
import type { PipelineListEntry } from "./usePipelineList";

const PAGE_SIZE = 10;

function toRows(
  files: PipelineFile[] = [],
): PipelineEntry<PipelineListEntry>[] {
  return files.map((file) => [
    file.referenceId,
    {
      name: file.displayName,
      modificationTime: file.modifiedAt,
      file,
    },
    {
      searchQuery: "",
      matchedFields: [],
      componentQuery: "",
      matchedComponentNames: [],
    },
  ]);
}

export function useRemotePipelineList() {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const queryKey = [...FoldersQueryKeys.All(), "remote-list", storage.scope];
  const pages = useInfiniteQuery({
    queryKey: [...queryKey, "pages"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      if (!storage.remote) throw new Error("Remote pipelines are not enabled.");
      return storage.remote.listPage({
        pageSize: PAGE_SIZE,
        pageToken: pageParam,
        signal,
      });
    },
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
  const showingCached = !!pages.error && !pages.data;
  const cached = useQuery({
    queryKey: [...queryKey, "cached"],
    queryFn: () => storage.remote?.listCached() ?? Promise.resolve([]),
    enabled: storage.remoteEnabled && showingCached,
  });
  useEffect(() => subscribeUserPipelineWritten(() => setPageIndex(0)), []);
  const safePageIndex = Math.min(
    pageIndex,
    Math.max(0, (pages.data?.pages.length ?? 1) - 1),
  );
  const page = pages.data?.pages[safePageIndex];
  const cachedRows = toRows(cached.data);
  const cachedPagination = usePagination(cachedRows, PAGE_SIZE, storage.scope);
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
        setPageIndex(safePageIndex + 1);
        return;
      }
      if (!pages.hasNextPage || pages.isFetching) return;
      const result = await pages.fetchNextPage();
      if ((result.data?.pages.length ?? 0) > safePageIndex + 1)
        setPageIndex(safePageIndex + 1);
    },
    goToPreviousPage: () => setPageIndex(Math.max(0, safePageIndex - 1)),
    resetPage: () => setPageIndex(0),
  };
  const pagination = showingCached ? cachedPagination : cursorPagination;
  const refresh = async () => {
    setPageIndex(0);
    cachedPagination.resetPage();
    await queryClient.resetQueries({ queryKey });
  };
  return {
    rows: showingCached ? cachedPagination.paginatedItems : toRows(page?.files),
    pagination,
    isPending: pages.isPending || (showingCached && cached.isPending),
    isFetching: pages.isFetching,
    error: pages.error?.message,
    showingCached,
    hasRemotePipelines,
    totalCount,
    refresh,
  };
}
