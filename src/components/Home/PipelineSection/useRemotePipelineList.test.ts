import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { usePipelineList } from "./usePipelineList";
import { useRemotePipelineList } from "./useRemotePipelineList";

interface Page {
  files: PipelineFile[];
  nextPageToken?: string;
  totalCount?: number;
}

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
      remote: { listPage, listSummaries, listPending, listCached },
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
    listCached.mockResolvedValue(cachedFiles);
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
