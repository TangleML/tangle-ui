import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedSearchValue } from "./useDebouncedSearchValue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDebouncedSearchValue", () => {
  it("preserves newer drafts when earlier commits echo back", () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedSearchValue(commit, 200, value),
      { initialProps: { value: "" } },
    );
    act(() => result.current[1]("first"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current[1]("second"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current[1]("third"));
    rerender({ value: "first" });
    rerender({ value: "second" });
    expect(result.current[0]).toBe("third");
    act(() => vi.advanceTimersByTime(200));
    expect(commit.mock.calls).toEqual([["first"], ["second"], ["third"]]);
  });

  it("forgets superseded commits when the latest value is acknowledged", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedSearchValue(vi.fn(), 200, value),
      { initialProps: { value: "" } },
    );
    act(() => result.current[1]("first"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current[1]("second"));
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "second" });
    act(() => result.current[1]("draft"));
    rerender({ value: "first" });
    expect(result.current[0]).toBe("first");
  });

  it("accepts external replacements and cancels an older draft", () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedSearchValue(commit, 200, value),
      { initialProps: { value: "initial" } },
    );
    act(() => result.current[1]("draft"));
    rerender({ value: "external" });
    expect(result.current[0]).toBe("external");
    act(() => vi.advanceTimersByTime(200));
    expect(commit).not.toHaveBeenCalled();
  });

  it("resets drafts even when the external value has not changed", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useDebouncedSearchValue(commit));
    act(() => result.current[1]("discarded"));
    act(() => result.current[2](""));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe("");
    expect(commit).not.toHaveBeenCalled();
    act(() => result.current[2](""));
    act(() => result.current[1]("next"));
    act(() => vi.advanceTimersByTime(200));
    expect(commit).toHaveBeenCalledExactlyOnceWith("next");
  });
});
