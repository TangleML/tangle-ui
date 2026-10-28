import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRunViewFavicon } from "./useRunViewFavicon";

const executionDataMock = vi.hoisted(() => ({
  current: {} as {
    rootState?: {
      child_execution_status_stats: Record<string, Record<string, number>>;
    };
  },
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: () => executionDataMock.current,
}));

const withTaskStatuses = (stats: Record<string, number>) => ({
  rootState: { child_execution_status_stats: { "execution-1": stats } },
});

const currentFavicon = () =>
  document.querySelector("link[rel*='icon']")?.getAttribute("href");

describe("useRunViewFavicon", () => {
  afterEach(() => {
    cleanup();
    executionDataMock.current = {};
  });

  it("keeps the default favicon until the run state loads", () => {
    renderHook(() => useRunViewFavicon());

    expect(currentFavicon()).toBe("/favicon.ico");
  });

  it("follows the run's status as it progresses", () => {
    executionDataMock.current = withTaskStatuses({ RUNNING: 1, SUCCEEDED: 2 });
    const { rerender } = renderHook(() => useRunViewFavicon());

    expect(currentFavicon()).toBe("/favicon-loading.ico");

    executionDataMock.current = withTaskStatuses({ SUCCEEDED: 3 });
    rerender();

    expect(currentFavicon()).toBe("/favicon-success.ico");
  });

  it("shows a failed run even while other tasks are still running", () => {
    executionDataMock.current = withTaskStatuses({ RUNNING: 2, FAILED: 1 });
    renderHook(() => useRunViewFavicon());

    expect(currentFavicon()).toBe("/favicon-failed.ico");
  });

  it("restores the default favicon when leaving the run view", () => {
    executionDataMock.current = withTaskStatuses({ CANCELLED: 1 });
    const { unmount } = renderHook(() => useRunViewFavicon());

    expect(currentFavicon()).toBe("/favicon-paused.ico");

    unmount();

    expect(currentFavicon()).toBe("/favicon.ico");
  });
});
