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
  pageToken?: string;
  backendUrl?: string;
  filterQuery?: string;
  enabled?: boolean;
}

function renderPage(initialProps: PageProps) {
  return renderHook(
    ({
      pageToken,
      backendUrl = BACKEND_URL,
      filterQuery,
      enabled = true,
    }: PageProps) =>
      useRemotePipelinesPage(backendUrl, pageToken, enabled, filterQuery),
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
  it.each([undefined, "third"])(
    "requests only the supplied cursor %s without fetching other pages",
    async (pageToken) => {
      const page = createPage("requested", "next");
      vi.mocked(listRemotePipelines).mockResolvedValue(page);
      const { result } = renderPage({ pageToken, filterQuery: "filtered" });

      await waitFor(() => expect(result.current.data).toEqual(page));
      expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
        BACKEND_URL,
        pageToken,
        "filtered",
      );
      expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
      expect(
        queryClient.getQueryData(
          RemotePipelineQueryKeys.Cursor(BACKEND_URL, "filtered", pageToken),
        ),
      ).toEqual(page);
    },
  );

  it("waits until fetching is enabled", async () => {
    vi.mocked(listRemotePipelines).mockResolvedValue(createPage("second"));
    const { result, rerender } = renderPage({
      pageToken: "second",
      enabled: false,
    });
    expect(listRemotePipelines).not.toHaveBeenCalled();
    expect(result.current.isFetching).toBe(false);

    rerender({ pageToken: "second", enabled: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listRemotePipelines).toHaveBeenCalledExactlyOnceWith(
      BACKEND_URL,
      "second",
      undefined,
    );
  });

  it("keeps the previous cursor's rows while the next cursor loads without mixing their caches", async () => {
    const secondPage = Promise.withResolvers<RemotePipelinesPage>();
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage("first", "second"))
      .mockReturnValueOnce(secondPage.promise);
    const { result, rerender } = renderPage({});
    await waitFor(() =>
      expect(result.current.data).toEqual(createPage("first", "second")),
    );

    rerender({ pageToken: "second" });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data).toEqual(createPage("first", "second"));
    expect(
      queryClient.getQueryData(
        RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, "second"),
      ),
    ).toBeUndefined();

    await act(async () => secondPage.resolve(createPage("second")));
    await waitFor(() =>
      expect(result.current.data).toEqual(createPage("second")),
    );
    expect(result.current.isPlaceholderData).toBe(false);
    expect(
      queryClient.getQueryData(
        RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, undefined),
      ),
    ).toEqual(createPage("first", "second"));
    expect(
      queryClient.getQueryData(
        RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, "second"),
      ),
    ).toEqual(createPage("second"));
  });

  it("isolates backend and filter caches and only keeps rows for the same backend", async () => {
    const filteredPage = Promise.withResolvers<RemotePipelinesPage>();
    const otherPage = Promise.withResolvers<RemotePipelinesPage>();
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage("original"))
      .mockReturnValueOnce(filteredPage.promise)
      .mockReturnValueOnce(otherPage.promise);
    const { result, rerender } = renderPage({});
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("original"),
    );

    rerender({ filterQuery: "filtered" });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.pipelines[0].id).toBe("original");
    await act(async () => filteredPage.resolve(createPage("filtered")));
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("filtered"),
    );

    rerender({
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
        RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, undefined),
      ),
    ).toEqual(createPage("original"));
    expect(
      queryClient.getQueryData(
        RemotePipelineQueryKeys.Cursor(BACKEND_URL, "filtered", undefined),
      ),
    ).toEqual(createPage("filtered"));
    expect(
      queryClient.getQueryData(
        RemotePipelineQueryKeys.Cursor(
          OTHER_BACKEND_URL,
          "filtered",
          undefined,
        ),
      ),
    ).toEqual(createPage("other"));
  });

  it("refreshes only the active cursor after backend invalidation", async () => {
    const firstKey = RemotePipelineQueryKeys.Cursor(
      BACKEND_URL,
      undefined,
      undefined,
    );
    const thirdKey = RemotePipelineQueryKeys.Cursor(
      BACKEND_URL,
      undefined,
      "third",
    );
    queryClient.setQueryData(firstKey, createPage("first", "second"));
    queryClient.setQueryData(thirdKey, createPage("third"));
    vi.mocked(listRemotePipelines)
      .mockResolvedValueOnce(createPage("old-second", "third"))
      .mockResolvedValueOnce(createPage("new-second", "new-third"));
    const { result } = renderPage({ pageToken: "second" });
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("old-second"),
    );

    act(() => invalidatePipelineQueries(queryClient, BACKEND_URL));
    await waitFor(() =>
      expect(result.current.data?.pipelines[0].id).toBe("new-second"),
    );
    expect(vi.mocked(listRemotePipelines).mock.calls).toEqual([
      [BACKEND_URL, "second", undefined],
      [BACKEND_URL, "second", undefined],
    ]);
    expect(queryClient.getQueryState(firstKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(thirdKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryData(firstKey)).toEqual(
      createPage("first", "second"),
    );
    expect(queryClient.getQueryData(thirdKey)).toEqual(createPage("third"));
  });

  it("invalidates every filter and cursor only for the changed backend", () => {
    const backendKeys = [
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, undefined, undefined),
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, "filtered", undefined),
      RemotePipelineQueryKeys.Cursor(BACKEND_URL, "filtered", "second"),
    ];
    const otherKeys = [
      RemotePipelineQueryKeys.Cursor(OTHER_BACKEND_URL, undefined, undefined),
      RemotePipelineQueryKeys.Cursor(OTHER_BACKEND_URL, "filtered", undefined),
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
