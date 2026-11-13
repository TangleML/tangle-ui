import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";

import { useRefreshSessionResources } from "./useRefreshSessionResources";

const thisChat = sessionResourcesKey("chat-1");
const otherChat = sessionResourcesKey("chat-2");

function renderRefresh() {
  const client = new QueryClient();
  client.setQueryData(thisChat, []);
  client.setQueryData(otherChat, []);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const hook = renderHook(() => useRefreshSessionResources(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const invalidated = (key: unknown[]) =>
    client.getQueryState(key)?.isInvalidated;
  return { ...hook, invalidate, invalidated };
}

describe("useRefreshSessionResources", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches one chat's resources, leaving other chats alone", () => {
    const { result, invalidated } = renderRefresh();

    result.current("chat-1");
    vi.advanceTimersByTime(1_000);

    expect(invalidated(thisChat)).toBe(true);
    expect(invalidated(otherChat)).toBe(false);
  });

  it("refetches once for a burst of changes, after the chat goes quiet", () => {
    const { result, invalidate } = renderRefresh();

    result.current("chat-1");
    vi.advanceTimersByTime(600);
    result.current("chat-1");
    vi.advanceTimersByTime(600);
    result.current("chat-1");
    vi.advanceTimersByTime(999);
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(invalidate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("refetches again for a change after the burst", () => {
    const { result, invalidate } = renderRefresh();

    result.current("chat-1");
    vi.advanceTimersByTime(1_000);
    result.current("chat-1");
    vi.advanceTimersByTime(1_000);

    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("keeps each chat's refetch when the open chat changes mid-burst", () => {
    const { result, rerender, invalidated } = renderRefresh();

    result.current("chat-1");
    rerender();
    result.current("chat-2");
    vi.advanceTimersByTime(1_000);

    expect(invalidated(thisChat)).toBe(true);
    expect(invalidated(otherChat)).toBe(true);
  });

  it("drops a waiting refetch when the page goes away", () => {
    const { result, unmount, invalidate } = renderRefresh();

    result.current("chat-1");
    unmount();
    vi.advanceTimersByTime(5_000);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
