import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineSearchFilters } from "@/types/pipelineSearch";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { usePipelineList } from "./usePipelineList";
import { useRemotePipelineList } from "./useRemotePipelineList";

interface Page {
  files: PipelineFile[];
  nextPageToken?: string;
  totalCount?: number;
}

const urlState = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  listeners: new Set<() => void>(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => urlState.navigate,
  useSearch: () =>
    useSyncExternalStore(
      (listener) => {
        urlState.listeners.add(listener);
        return () => urlState.listeners.delete(listener);
      },
      () => urlState.search,
    ),
}));

const {
  storage,
  listPage,
  listSummaries,
  listPending,
  listCached,
  getLocalEntries,
} = vi.hoisted(() => {
  const listPage =
    vi.fn<
      (options: {
        pageSize: number;
        pageToken?: string;
        filters?: PipelineSearchFilters;
        signal?: AbortSignal;
      }) => Promise<Page>
    >();
  const listSummaries = vi.fn<() => Promise<PipelineFile[]>>();
  const listPending = vi.fn<() => Promise<PipelineFile[]>>();
  const listCached = vi.fn<() => Promise<PipelineFile[]>>();
  return {
    storage: {
      scope: "account-a",
      remoteEnabled: true,
      listRemotePipelinePage: listPage,
      listPipelines: listSummaries,
      listPendingPipelines: listPending,
      listCachedPipelines: listCached,
      rootFolder: { assignFile: vi.fn() },
      filterVisibleLocalPipelines: vi.fn(),
    },
    listPage,
    listSummaries,
    listPending,
    listCached,
    getLocalEntries: vi.fn(),
  };
});

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/utils/componentStore", () => ({
  getAllComponentFilesFromList: getLocalEntries,
  loadComponentAsRefFromText: vi.fn(),
}));

const clients: QueryClient[] = [];

function file(
  index: number,
  name = `Pipeline ${index}`,
  modifiedAt = new Date(Date.UTC(2026, 8, 22, 12, -index)),
): PipelineFile {
  return {
    id: `remote:backend:${index}`,
    referenceId: `remote:backend:${index}`,
    displayName: name,
    storageKind: "remote",
    modifiedAt,
    read: vi.fn().mockRejectedValue(new Error("Definitions must not be read")),
  } as unknown as PipelineFile;
}

function renderList(withLocal = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const useList = withLocal
    ? () => {
        usePipelineList();
        return useRemotePipelineList();
      }
    : useRemotePipelineList;
  return { ...renderHook(useList, { wrapper }), client };
}

function expectNoDefinitions(files: PipelineFile[]) {
  for (const pipeline of files) expect(pipeline.read).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  urlState.search = {};
  urlState.navigate.mockImplementation(({ search }) => {
    urlState.search = search(urlState.search);
    urlState.listeners.forEach((listener) => listener());
    return Promise.resolve();
  });
  storage.scope = "account-a";
  storage.remoteEnabled = true;
  listPage.mockResolvedValue({ files: [], totalCount: 0 });
  listSummaries.mockResolvedValue([]);
  listPending.mockResolvedValue([]);
  listCached.mockResolvedValue([]);
  getLocalEntries.mockResolvedValue(new Map());
  storage.filterVisibleLocalPipelines.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

describe("useRemotePipelineList", () => {
  it("uses every shared URL filter on the first request without loading the default collection", async () => {
    urlState.search = {
      q: "Daily & weekly",
      owner: "",
      edited_from: "2026-03-08",
      edited_to: "2026-03-08",
      annotations: [{ key: "team", value: "data" }, { key: "published" }],
      sort_field: "name",
      sort_direction: "asc",
    };
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(listPage).toHaveBeenCalledTimes(1);
    expect(listPage).toHaveBeenCalledWith(
      expect.objectContaining({
        pageToken: undefined,
        filters: {
          searchQuery: "Daily & weekly",
          userId: undefined,
          modifiedAfter: new Date(2026, 2, 8).toISOString(),
          modifiedBefore: new Date(2026, 2, 9).toISOString(),
          annotations: [{ key: "team", value: "data" }, { key: "published" }],
          sortField: "name",
          sortDirection: "asc",
        },
      }),
    );
    expect(result.current.searchQuery).toBe("Daily & weekly");
    expect(result.current.userId).toBe("");
    expect(result.current.hasSearchFilters).toBe(true);
  });

  it("resets cursors on sort changes and retains sorting across pages, refresh, and clearing filters", async () => {
    const first = file(0, "Report Z");
    const second = file(1, "Report A");
    urlState.search = { q: "Report" };
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "date-next",
    });
    listPage.mockResolvedValueOnce({ files: [second] });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => result.current.pagination.goToNextPage());
    expect(result.current.pagination.currentPage).toBe(2);
    listPage.mockResolvedValueOnce({
      files: [second],
      nextPageToken: "name-next",
    });
    listPage.mockResolvedValueOnce({ files: [first] });

    act(() => {
      result.current.setSortField("name");
      result.current.setSortDirection("asc");
    });
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const filters = {
      userId: "me",
      searchQuery: "Report",
      sortField: "name",
      sortDirection: "asc",
    };
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters, pageToken: undefined }),
    );
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.rows[0][0]).toBe(second.referenceId);

    await act(async () => result.current.pagination.goToNextPage());
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters, pageToken: "name-next" }),
    );
    expect(result.current.pagination.currentPage).toBe(2);
    listPage.mockResolvedValue({ files: [second, first] });
    await act(async () => result.current.refresh());
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters, pageToken: undefined }),
    );
    expect(result.current.pagination.currentPage).toBe(1);

    act(() => result.current.setSortDirection("desc"));
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(6));
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: { userId: "me", searchQuery: "Report", sortField: "name" },
        pageToken: undefined,
      }),
    );
    act(() => result.current.clearFilters());
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(7));
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: { userId: "me", sortField: "name" },
        pageToken: undefined,
      }),
    );
    expectNoDefinitions([first, second]);
  });

  it.each([
    ["name", "asc", [1, 0, 2]],
    ["name", "desc", [2, 0, 1]],
    ["updated_at", "asc", [2, 1, 0]],
    ["updated_at", "desc", [0, 1, 2]],
  ] as const)(
    "sorts the cached fallback by %s %s without reading definitions",
    async (sortField, sortDirection, order) => {
      const files = [file(0, "beta"), file(1, "Alpha"), file(2, "gamma")];
      urlState.search = {
        sort_field: sortField,
        sort_direction: sortDirection,
      };
      listPage.mockRejectedValue(new Error("Server unavailable"));
      listCached.mockResolvedValue(files);
      const { result } = renderList();

      await waitFor(() => expect(result.current.rows).toHaveLength(3));
      expect(result.current.rows.map(([id]) => id)).toEqual(
        order.map((index) => files[index].referenceId),
      );
      expect(result.current.showingCached).toBe(true);
      expect(result.current.hasSearchFilters).toBe(false);
      expectNoDefinitions(files);
    },
  );

  it("restores URL changes and cancels a pending search when navigating to another filter", async () => {
    const { result, rerender } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.setSearchQuery("unfinished search"));

    urlState.search = { q: "restored search", owner: "another-user" };
    rerender();

    expect(result.current.searchQuery).toBe("restored search");
    expect(result.current.userId).toBe("another-user");
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: { searchQuery: "restored search", userId: "another-user" },
        pageToken: undefined,
      }),
    );
  });

  it("debounces combined search and owner changes, resetting cursors even when returning to cached results", async () => {
    const first = file(0);
    const second = file(1);
    const match = file(2, "Daily report");
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "mine-next",
    });
    listPage.mockResolvedValueOnce({ files: [second] });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => result.current.pagination.goToNextPage());
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2));
    listPage.mockResolvedValue({ files: [match], totalCount: 1 });

    act(() => {
      result.current.setSearchQuery("  Daily  ");
      result.current.setUserId("other@example.com");
    });
    expect(listPage).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(result.current.rows[0]?.[0]).toBe(match.referenceId),
    );
    expect(listPage).toHaveBeenLastCalledWith({
      pageSize: 10,
      pageToken: undefined,
      signal: expect.any(AbortSignal),
      filters: { searchQuery: "Daily", userId: "other@example.com" },
    });
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.rows[0][2].searchQuery).toBe("Daily");

    act(() => {
      result.current.setSearchQuery("");
      result.current.setUserId("me");
    });
    await waitFor(() =>
      expect(result.current.rows[0]?.[0]).toBe(first.referenceId),
    );
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.hasPreviousPage).toBe(false);
    expect(listPage).toHaveBeenCalledTimes(3);
    expectNoDefinitions([first, second, match]);
  });

  it("keeps text and annotation filters on subsequent pages and refresh", async () => {
    const first = file(0, "Report one");
    const second = file(1, "Report two");
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "search-next",
    });
    listPage.mockResolvedValueOnce({ files: [second] });

    act(() => {
      result.current.setSearchQuery("Report");
      result.current.setAnnotations([{ key: "team", value: "data" }]);
    });
    await waitFor(() =>
      expect(result.current.rows[0]?.[0]).toBe(first.referenceId),
    );
    await act(async () => result.current.pagination.goToNextPage());
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: "search-next",
        filters: {
          searchQuery: "Report",
          userId: "me",
          annotations: [{ key: "team", value: "data" }],
        },
      }),
    );
    listPage.mockResolvedValue({ files: [first] });

    await act(async () => result.current.refresh());
    await waitFor(() =>
      expect(result.current.rows[0]?.[0]).toBe(first.referenceId),
    );
    expect(result.current.pagination.currentPage).toBe(1);
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: undefined,
        filters: {
          searchQuery: "Report",
          userId: "me",
          annotations: [{ key: "team", value: "data" }],
        },
      }),
    );
  });

  it("applies whole local days to date searches and preserves them on later pages", async () => {
    const first = file(0);
    const second = file(1);
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "all-next",
    });
    listPage.mockResolvedValueOnce({ files: [second] });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => result.current.pagination.goToNextPage());
    expect(result.current.pagination.currentPage).toBe(2);
    const from = new Date(2026, 2, 8, 13);
    const to = new Date(2026, 2, 8, 19);
    const filters = {
      userId: "me",
      searchQuery: undefined,
      modifiedAfter: new Date(2026, 2, 8).toISOString(),
      modifiedBefore: new Date(2026, 2, 9).toISOString(),
    };
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "dated-next",
    });
    listPage.mockResolvedValueOnce({ files: [second] });

    act(() => result.current.setDateRange({ from, to }));
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.pagination.currentPage).toBe(1);
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: undefined,
        filters,
      }),
    );
    expect(result.current.hasSearchFilters).toBe(true);
    await act(async () => result.current.pagination.goToNextPage());
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: "dated-next",
        filters,
      }),
    );
    await act(async () => result.current.refresh());
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: undefined,
        filters,
      }),
    );
    expectNoDefinitions([first, second]);
  });

  it("clears text, dates, owner, and annotations together and returns to the first cached page", async () => {
    const first = file(0);
    listPage.mockResolvedValue({ files: [first], totalCount: 1 });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => {
      result.current.setSearchQuery("Daily");
      result.current.setUserId("another-owner");
      result.current.setDateRange({ from: new Date(2026, 8, 18) });
      result.current.setAnnotations([{ key: "team" }]);
    });
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));
    act(() => result.current.clearFilters());
    expect(result.current.searchQuery).toBe("");
    expect(result.current.userId).toBe("me");
    expect(result.current.dateRange).toBeUndefined();
    expect(result.current.annotations).toEqual([]);
    expect(result.current.hasSearchFilters).toBe(false);
    await waitFor(() =>
      expect(result.current.filterKey).toBe('{"userId":"me"}'),
    );
    expect(result.current.rows[0]?.[0]).toBe(first.referenceId);
    expect(result.current.pagination.currentPage).toBe(1);
    expect(listPage).toHaveBeenCalledTimes(2);
  });

  it.each(["search", "all owners", "date range", "annotations"])(
    "does not substitute unrelated recovery copies when %s fails",
    async (filter) => {
      const { result } = renderList();
      await waitFor(() => expect(result.current.isPending).toBe(false));
      listPage.mockRejectedValue(new Error("Search unavailable"));
      listCached.mockResolvedValue([file(0, "Unrelated cached pipeline")]);

      act(() => {
        if (filter === "search") result.current.setSearchQuery("Report");
        else if (filter === "date range")
          result.current.setDateRange({ from: new Date(2026, 8, 18) });
        else if (filter === "annotations")
          result.current.setAnnotations([{ key: "team", value: "data" }]);
        else result.current.setUserId("");
      });
      await waitFor(() =>
        expect(result.current.error).toBe("Search unavailable"),
      );
      expect(result.current.showingCached).toBe(false);
      expect(result.current.isPending).toBe(false);
      expect(result.current.rows).toEqual([]);
      expect(listCached).not.toHaveBeenCalled();
      if (filter === "all owners") {
        expect(listPage).toHaveBeenLastCalledWith(
          expect.objectContaining({
            filters: { searchQuery: undefined, userId: undefined },
            pageToken: undefined,
          }),
        );
      }
    },
  );

  it("resets pagination when annotations are edited or removed without reading definitions", async () => {
    const first = file(0);
    const second = file(1);
    listPage.mockResolvedValue({ files: [first], nextPageToken: "next" });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.setAnnotations([{ key: "team", value: "data" }]));
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));
    listPage.mockResolvedValue({ files: [second] });
    await act(async () => result.current.pagination.goToNextPage());
    expect(result.current.pagination.currentPage).toBe(2);

    act(() =>
      result.current.setAnnotations([{ key: "team", value: "research" }]),
    );
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(4));
    expect(listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: undefined,
        filters: expect.objectContaining({
          annotations: [{ key: "team", value: "research" }],
        }),
      }),
    );
    expect(result.current.pagination.currentPage).toBe(1);

    act(() => result.current.setAnnotations([]));
    await waitFor(() =>
      expect(result.current.rows[0]?.[0]).toBe(first.referenceId),
    );
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.hasSearchFilters).toBe(false);
    expect(listPage).toHaveBeenCalledTimes(4);
    expectNoDefinitions([first, second]);
  });

  it("ignores a pending next page after the search changes", async () => {
    listPage.mockResolvedValueOnce({
      files: [file(0)],
      nextPageToken: "old-next",
    });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    let finishNextPage!: (page: Page) => void;
    listPage.mockReturnValueOnce(
      new Promise((resolve) => {
        finishNextPage = resolve;
      }),
    );
    let navigation!: Promise<void>;
    act(() => {
      navigation = Promise.resolve(result.current.pagination.goToNextPage());
    });
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));
    const oldSignal = listPage.mock.calls[1][0].signal;
    const match = file(2, "Report");
    listPage.mockResolvedValue({ files: [match], totalCount: 1 });

    act(() => result.current.setSearchQuery("Report"));
    await waitFor(() =>
      expect(result.current.rows[0]?.[0]).toBe(match.referenceId),
    );
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      finishNextPage({ files: [file(1, "Stale next page")] });
      await navigation;
    });
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.rows.map(([id]) => id)).toEqual([match.referenceId]);
  });

  it("loads one summary page at a time and revisits cached pages without definition reads", async () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      file(index, "Same name"),
    );
    listPage.mockResolvedValueOnce({
      files: files.slice(0, 10),
      nextPageToken: "page-two",
      totalCount: 12,
    });
    listPage.mockResolvedValueOnce({ files: files.slice(10), totalCount: 12 });

    const { result } = renderList();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(listPage).toHaveBeenCalledExactlyOnceWith({
      pageSize: 10,
      pageToken: undefined,
      filters: { userId: "me" },
      signal: expect.any(AbortSignal),
    });
    expect(result.current.rows.map(([id]) => id)).toEqual(
      files.slice(0, 10).map((pipeline) => pipeline.referenceId),
    );
    expect(result.current.hasRemotePipelines).toBe(true);
    expect(result.current.totalCount).toBe(12);
    expect(result.current.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    await act(async () => result.current.pagination.goToNextPage());

    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2));
    expect(listPage).toHaveBeenLastCalledWith({
      pageSize: 10,
      pageToken: "page-two",
      filters: { userId: "me" },
      signal: expect.any(AbortSignal),
    });
    expect(result.current.rows.map(([id]) => id)).toEqual(
      files.slice(10).map((pipeline) => pipeline.referenceId),
    );
    expect(result.current.pagination.hasNextPage).toBe(false);

    act(() => result.current.pagination.goToPreviousPage());
    expect(result.current.pagination.currentPage).toBe(1);
    await act(async () => result.current.pagination.goToNextPage());
    expect(result.current.pagination.currentPage).toBe(2);
    expect(listPage).toHaveBeenCalledTimes(2);
    expect(listSummaries).not.toHaveBeenCalled();
    expect(listCached).not.toHaveBeenCalled();
    expectNoDefinitions(files);
  });

  it("does not expose the previous account's rows or cursor while the new scope loads", async () => {
    const accountA = file(0, "Account A");
    const accountANext = file(1, "Account A next page");
    const accountB = file(2, "Account B");
    listPage.mockResolvedValueOnce({
      files: [accountA],
      nextPageToken: "account-a-next",
      totalCount: 2,
    });
    listPage.mockResolvedValueOnce({ files: [accountANext], totalCount: 2 });
    const { result, rerender } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => result.current.pagination.goToNextPage());
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2));
    let resolveAccountB!: (page: Page) => void;
    listPage.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAccountB = resolve;
      }),
    );

    storage.scope = "account-b";
    rerender();

    expect(result.current.isPending).toBe(true);
    expect(result.current.rows).toEqual([]);
    expect(result.current.hasRemotePipelines).toBeUndefined();
    expect(result.current.pagination.currentPage).toBe(1);
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(3));
    expect(listPage).toHaveBeenLastCalledWith({
      pageSize: 10,
      pageToken: undefined,
      filters: { userId: "me" },
      signal: expect.any(AbortSignal),
    });
    await act(async () =>
      resolveAccountB({ files: [accountB], totalCount: 1 }),
    );
    await waitFor(() =>
      expect(result.current.rows.map(([id]) => id)).toEqual([
        accountB.referenceId,
      ]),
    );
    expect(result.current.pagination.hasPreviousPage).toBe(false);
  });

  it("returns to fresh first-page rows after a write invalidates both tabs", async () => {
    const first = file(0);
    const second = file(1);
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "old-next",
      totalCount: 2,
    });
    listPage.mockResolvedValueOnce({ files: [second], totalCount: 2 });
    const { result } = renderList(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => result.current.pagination.goToNextPage());
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2));
    const refreshed = file(2, "Newly uploaded pipeline");
    listPage.mockResolvedValue({ files: [refreshed], totalCount: 1 });

    await act(async () => emitUserPipelineWritten());

    await waitFor(() =>
      expect(result.current.rows.map(([id]) => id)).toEqual([
        refreshed.referenceId,
      ]),
    );
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.hasPreviousPage).toBe(false);
    expect(listPage).toHaveBeenLastCalledWith({
      pageSize: 10,
      pageToken: undefined,
      filters: { userId: "me" },
      signal: expect.any(AbortSignal),
    });
    expectNoDefinitions([first, second, refreshed]);
  });

  it("does not reopen a stale next page when a refresh finishes during navigation", async () => {
    const first = file(0);
    const staleNext = file(1);
    listPage.mockResolvedValueOnce({
      files: [first],
      nextPageToken: "old-next",
      totalCount: 2,
    });
    const { result } = renderList();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    let finishNextPage!: (page: Page) => void;
    listPage.mockReturnValueOnce(
      new Promise((resolve) => {
        finishNextPage = resolve;
      }),
    );
    let navigation!: Promise<void>;
    act(() => {
      navigation = Promise.resolve(result.current.pagination.goToNextPage());
    });
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));
    const nextPageSignal = listPage.mock.calls[1][0].signal;
    const refreshed = file(2, "New first page");
    listPage.mockResolvedValue({ files: [refreshed], totalCount: 1 });

    await act(async () => result.current.refresh());

    await waitFor(() =>
      expect(result.current.rows.map(([id]) => id)).toEqual([
        refreshed.referenceId,
      ]),
    );
    expect(nextPageSignal?.aborted).toBe(true);
    await act(async () => {
      finishNextPage({ files: [staleNext], totalCount: 2 });
      await navigation;
    });
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.rows.map(([id]) => id)).toEqual([
      refreshed.referenceId,
    ]);
    expectNoDefinitions([first, staleNext, refreshed]);
  });

  it("shows a list failure separately from a confirmed empty remote collection", async () => {
    listPage.mockRejectedValue(new Error("Server unavailable"));
    const { result } = renderList();

    await waitFor(() =>
      expect(result.current.error).toBe("Server unavailable"),
    );

    expect(result.current.hasRemotePipelines).toBeUndefined();
    expect(result.current.rows).toEqual([]);
    listPage.mockResolvedValue({ files: [], totalCount: 0 });
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(result.current.hasRemotePipelines).toBe(false);
  });

  it("paginates cached remote summaries during an outage without mixing in local drafts or hiding the error", async () => {
    const cachedFiles = Array.from({ length: 12 }, (_, index) => file(index));
    const localDraft = {
      ...file(100, "Offline draft"),
      referenceId: "Offline draft",
      storageKey: "Offline draft",
      storageKind: "local",
    } as unknown as PipelineFile;
    getLocalEntries.mockResolvedValue(
      new Map([["Offline draft", { name: "Offline draft" }]]),
    );
    storage.rootFolder.assignFile.mockResolvedValue(localDraft);
    storage.filterVisibleLocalPipelines.mockResolvedValue([localDraft]);
    listPage.mockRejectedValue(new Error("Server unavailable"));
    listCached.mockResolvedValue(cachedFiles.toReversed());
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    clients.push(client);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(
      () => ({ remote: useRemotePipelineList(), local: usePipelineList() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.remote.rows).toHaveLength(10));
    await waitFor(() => expect(result.current.local.isSuccess).toBe(true));

    expect(result.current.remote.rows.map(([id]) => id)).toEqual(
      cachedFiles.slice(0, 10).map((entry) => entry.referenceId),
    );

    expect(result.current.remote.showingCached).toBe(true);
    expect(result.current.remote.error).toBe("Server unavailable");
    expect(result.current.remote.hasRemotePipelines).toBeUndefined();
    expect(result.current.remote.totalCount).toBe(12);
    expect(result.current.remote.pagination.totalPages).toBe(2);
    expect([...result.current.local.data!.pipelines.keys()]).toEqual([
      "Offline draft",
    ]);
    expect(result.current.local.data?.error).toBe("");
    act(() => result.current.remote.pagination.goToNextPage());
    expect(result.current.remote.rows.map(([id]) => id)).toEqual(
      cachedFiles.slice(10).map((pipeline) => pipeline.referenceId),
    );
    expect(result.current.remote.error).toBe("Server unavailable");
    expect(listPage).toHaveBeenCalledOnce();
    expect(listCached).toHaveBeenCalledOnce();
    expect(listSummaries).not.toHaveBeenCalled();
    expectNoDefinitions([...cachedFiles, localDraft]);
  });
});
