import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./useNow";

const START = new Date("2024-01-02T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("advances on every interval", () => {
    const { result } = renderHook(() => useNow(1000));
    expect(result.current).toBe(START);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(START + 1000);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(START + 3000);
  });

  it("stays put while disabled", () => {
    const { result } = renderHook(() => useNow(1000, false));

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(START);
  });

  it("stops ticking after unmount", () => {
    const { unmount } = renderHook(() => useNow(1000));
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
