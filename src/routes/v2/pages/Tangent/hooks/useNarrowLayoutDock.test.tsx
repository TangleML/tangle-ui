import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NARROW_LAYOUT_WIDTH } from "@/routes/v2/pages/Tangent/layout";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { useNarrowLayoutDock } from "./useNarrowLayoutDock";

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: vi.fn(),
}));

const setDockAreaCollapsed = vi.fn();
let collapsed = false;

function resizeTo(width: number) {
  window.innerWidth = width;
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

const WIDE = NARROW_LAYOUT_WIDTH + 200;
const NARROW = NARROW_LAYOUT_WIDTH - 200;

describe("useNarrowLayoutDock", () => {
  beforeEach(() => {
    collapsed = false;
    setDockAreaCollapsed.mockImplementation((_side, next) => {
      collapsed = next;
    });
    vi.mocked(useSharedStores).mockReturnValue({
      windows: {
        getDockAreaConfig: () => ({ collapsed }),
        setDockAreaCollapsed,
      },
    } as unknown as ReturnType<typeof useSharedStores>);
    window.innerWidth = WIDE;
  });
  afterEach(() => vi.resetAllMocks());

  it("leaves the dock open on a window with room for three columns", () => {
    renderHook(() => useNarrowLayoutDock());

    expect(setDockAreaCollapsed).not.toHaveBeenCalled();
  });

  it("collapses the dock to its rail when the window is too narrow", () => {
    window.innerWidth = NARROW;

    renderHook(() => useNarrowLayoutDock());

    expect(setDockAreaCollapsed).toHaveBeenCalledWith("left", true);
  });

  it("restores the dock when the window is wide enough again", () => {
    renderHook(() => useNarrowLayoutDock());

    resizeTo(NARROW);
    resizeTo(WIDE);

    expect(setDockAreaCollapsed).toHaveBeenLastCalledWith("left", false);
  });

  /** Reopening a dock someone shut reads as the app fighting the mouse. */
  it("leaves a dock the user collapsed alone", () => {
    collapsed = true;

    renderHook(() => useNarrowLayoutDock());
    resizeTo(NARROW);
    resizeTo(WIDE);

    expect(setDockAreaCollapsed).not.toHaveBeenCalledWith("left", false);
  });
});
