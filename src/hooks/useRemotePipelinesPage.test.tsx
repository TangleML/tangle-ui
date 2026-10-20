import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invalidatePipelineQueries } from "@/services/pipelineStorage/invalidatePipelineQueries";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import {
  listRemotePipelines,
  type RemotePipelinesPage,
} from "@/services/remotePipelinesService";

import { useRemotePipelinesPage } from "./useRemotePipelinesPage";

vi.mock("@/services/remotePipelinesService", () => ({
  listRemotePipelines: vi.fn(),
}));

const BACKEND_URL = "https://backend.example.com";
const OTHER_BACKEND_URL = "https://other.example.com";
let queryClient: QueryClient;

function createPage(
  id: string,
  nextPageToken: string | null = null,
): RemotePipelinesPage {
  return {
    pipelines: [
      {
        id,
        user_id: "user@example.com",
        pipeline_name: id,
        file_path: id,
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        current_version: "version-1",
        versioning_mode: "full",
      },
    ],
    nextPageToken,
  };
}

interface PageProps {
  page: number;
  backendUrl?: string;
  filterQuery?: string;
}

function renderPage(initialProps: PageProps) {
  return renderHook(
    ({ page, backendUrl = BACKEND_URL, filterQuery }: PageProps) =>
      useRemotePipelinesPage(backendUrl, page, true, filterQuery),
    {
      initialProps,
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.resetAllMocks();
});

describe("useRemotePipelinesPage", () => {
  it("walks cold cursors without exposing intermediate pages", async () => {
    const secondPage = Promise.withResolvers<RemotePipelinesPage>();
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage("first", "second"))
      .mockReturnValueOnce(secondPage.promise)
      .mockResolvedValueOnce(createPage("third"));
    const { result } = renderPage({ page: 3 });

    await waitFor(() =>
      expect(listRemotePipelines).toHaveBeenLastCalledWith(
        BACKEND_URL,
        "second",
        undefined,
      ),
    );
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);

    await act(async () => secondPage.resolve(createPage("second", "third")));
    await waitFor(() =>
      expect(result.current.data).toEqual({
        ...createPage("third"),
        page: 3,
      }),
    );
    expect(
      vi.mocked(listRemotePipelines).mock.calls.map(([, token]) => token),
    ).toEqual([undefined, "second", "third"]);
  });

  it("follows refreshed cursors after returning to the first page", async () => {
    let refreshed = false;
    vi.mocked(listRemotePipelines).mockImplementation(async (_, token) => {
      if (token === "old-second") return createPage("old-second", "old-third");
      if (token === "new-second") return createPage("new-second", "new-third");
      if (token === "new-third") return createPage("new-third");
      return refreshed
        ? createPage("new-first", "new-second")
        : createPage("old-first", "old-second");
    });
    const { result, rerender } = renderPage({ page: 2 });
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("old-second"),
    );

    refreshed = true;
    rerender({ page: 1 });
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("new-first"),
    );
    rerender({ page: 3 });
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("new-third"),
    );
    expect(listRemotePipelines).not.toHaveBeenCalledWith(
      BACKEND_URL,
      "old-third",
      undefined,
    );
  });

  it("refreshes a cached final page before finding newly added pages", async () => {
    queryClient.setQueryData(
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, undefined),
      createPage("first", "second"),
    );
    queryClient.setQueryData(
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, "second"),
      createPage("second"),
    );
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage("second", "third"))
      .mockResolvedValueOnce(createPage("third"));
    const { result } = renderPage({ page: 3 });

    await waitFor(() =>
      expect(result.current.data).toEqual({ ...createPage("third"), page: 3 }),
    );
    expect(
      vi.mocked(listRemotePipelines).mock.calls.map(([, token]) => token),
    ).toEqual(["second", "third"]);
  });

  it("keeps an out-of-range result fetching until its final page is refreshed", async () => {
    const firstPage = Promise.withResolvers<RemotePipelinesPage>();
    const cachedPage = { ...createPage("cached-final"), page: 1 };
    queryClient.setQueryData(
      RemotePipelineQueryKeys.Page(BACKEND_URL, undefined, 99),
      cachedPage,
    );
    queryClient.setQueryData(
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, undefined),
      cachedPage,
    );
    vi.mocked(listRemotePipelines)
      .mockReturnValueOnce(firstPage.promise)
      .mockResolvedValueOnce(createPage("new-final"));
    const { result } = renderPage({ page: 99 });

    await waitFor(() => expect(listRemotePipelines).toHaveBeenCalled());
    expect(result.current.data?.page).toBe(1);
    expect(result.current.isFetching).toBe(true);

    await act(async () => firstPage.resolve(createPage("first", "second")));
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual({
      ...createPage("new-final"),
      page: 2,
    });
  });

  it("isolates backend and filter caches and only keeps rows for the same backend", async () => {
    const filteredPage = Promise.withResolvers<RemotePipelinesPage>();
    const otherPage = Promise.withResolvers<RemotePipelinesPage>();
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage("original"))
      .mockReturnValueOnce(filteredPage.promise)
      .mockReturnValueOnce(otherPage.promise);
    const { result, rerender } = renderPage({ page: 1 });
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("original"),
    );

    rerender({ page: 1, filterQuery: "filtered" });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.pipelines[0].id).toBe("original");
    await act(async () => filteredPage.resolve(createPage("filtered")));
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("filtered"),
    );

    rerender({
      page: 1,
      backendUrl: OTHER_BACKEND_URL,
      filterQuery: "filtered",
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
    await act(async () => otherPage.resolve(createPage("other")));
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("other"),
    );
    expect(vi.mocked(listRemotePipelines).mock.calls).toEqual([
      [BACKEND_URL, undefined, undefined],
      [BACKEND_URL, undefined, "filtered"],
      [OTHER_BACKEND_URL, undefined, "filtered"],
    ]);
    expect(
      queryClient.getQueryData(
        RemotePipelineQueryKeys.Page(BACKEND_URL, undefined, 1),
      ),
    ).toEqual({ ...createPage("original"), page: 1 });
  });

  it("refreshes invalidated predecessor cursors before reloading an active later page", async () => {
    let refreshed = false;
    vi.mocked(listRemotePipelines).mockImplementation(async (_, token) => {
      if (token === "old-second") return createPage("old-second");
      if (token === "new-second") return createPage("new-second");
      return refreshed
        ? createPage("new-first", "new-second")
        : createPage("old-first", "old-second");
    });
    const { result } = renderPage({ page: 2 });
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("old-second"),
    );

    refreshed = true;
    act(() => invalidatePipelineQueries(queryClient, BACKEND_URL));
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("new-second"),
    );
    expect(
      vi.mocked(listRemotePipelines).mock.calls.map(([, token]) => token),
    ).toEqual([undefined, "old-second", undefined, "new-second"]);
  });

  it("invalidates page and cursor caches only for the changed backend", () => {
    const backendKeys = [
      RemotePipelineQueryKeys.Page(BACKEND_URL, "filtered", 2),
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, "filtered", "second"),
    ];
    const otherKeys = [
      RemotePipelineQueryKeys.Page(OTHER_BACKEND_URL, "filtered", 2),
      RemotePipelineQueryKeys.Cursor(OTHER_BACKEND_URL, "filtered", "second"),
    ];
    for (const key of [...backendKeys, ...otherKeys]) {
      queryClient.setQueryData(key, createPage("cached"));
    }

    invalidatePipelineQueries(queryClient, BACKEND_URL);

    for (const key of backendKeys)
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of otherKeys)
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
