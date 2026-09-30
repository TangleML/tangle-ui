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

function makeStore() {
  return {
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

  it("does nothing when no session was asked for", () => {
    const store = makeStore();

    renderHook(() => useTangentSessionParam(store));

    expect(store.selectSession).not.toHaveBeenCalled();
    expect(store.startSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
