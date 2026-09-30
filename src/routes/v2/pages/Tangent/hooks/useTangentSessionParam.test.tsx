import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { useTangentSessionParam } from "./useTangentSessionParam";

const navigate = vi.fn();
let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search,
  useNavigate: () => navigate,
}));

function makeStore(canStartSession = true) {
  return {
    canStartSession,
    selectSession: vi.fn(),
    startSession: vi.fn().mockResolvedValue(true),
  } as unknown as TangentProjectStore;
}

describe("useTangentSessionParam", () => {
  beforeEach(() => {
    search = {};
  });
  afterEach(() => vi.resetAllMocks());

  it("opens the session the project page linked to", () => {
    search = { session: "sess-a" };
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).toHaveBeenCalledWith("sess-a");
    expect(store.startSession).not.toHaveBeenCalled();
  });

  it("starts one when that is what was asked for", () => {
    search = { session: "new" };
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.startSession).toHaveBeenCalled();
    expect(store.selectSession).not.toHaveBeenCalled();
  });

  /** Left in the url, a reload would start a second session. */
  it("takes the request out of the url once it is done", () => {
    search = { session: "new" };

    renderHook(() => useTangentSessionParam(makeStore()));

    expect(navigate).toHaveBeenCalled();
    const { search: rewrite, replace } = navigate.mock.calls[0][0];
    expect(replace).toBe(true);
    expect(rewrite({ session: "new", other: "kept" })).toEqual({
      other: "kept",
    });
  });

  it("acts once however often it re-renders", () => {
    search = { session: "new" };
    const store = makeStore();

    const { rerender } = renderHook(() => useTangentSessionParam(store));
    rerender();
    rerender();

    expect(store.startSession).toHaveBeenCalledTimes(1);
  });

  /**
   * This hook runs in a child of the provider that wires the store up, and a
   * child's effects run first, so on the first commit there is no way to reach
   * Tangent yet. Consuming the ask there left the caller on whichever session
   * was already selected, which is what asking for a new one is not.
   */
  it("waits until the store can start one rather than dropping the request", () => {
    search = { session: "new" };
    const store = makeStore(false);

    const { rerender } = renderHook(() => useTangentSessionParam(store));

    expect(store.startSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    (store as { canStartSession: boolean }).canStartSession = true;
    rerender();

    expect(store.startSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalled();
  });

  /** Selecting a session needs nothing of Tangent, so it need not wait. */
  it("opens an existing session before the store could start one", () => {
    search = { session: "sess-a" };
    const store = makeStore(false);

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).toHaveBeenCalledWith("sess-a");
  });

  it("does nothing when no session was asked for", () => {
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).not.toHaveBeenCalled();
    expect(store.startSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
