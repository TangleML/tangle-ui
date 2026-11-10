import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import {
  PROJECT_CARD_WINDOW_ID,
  PROJECTS_WINDOW_ID,
  useTangentProjectWindows,
} from "./useTangentProjectWindows";

const stores = vi.hoisted(() => ({
  windows: undefined as WindowStoreImpl | undefined,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: stores.windows }),
}));

vi.mock("@/routes/v2/pages/Tangent/components/ProjectsWindowContent", () => ({
  ProjectsWindowContent: () => null,
}));

vi.mock("@/routes/v2/pages/Tangent/components/ProjectCardContent", () => ({
  ProjectCardContent: () => null,
}));

function dockedStore() {
  const windows = new WindowStoreImpl();
  windows.enableDockSide("left");
  windows.enableDockSide("right");
  stores.windows = windows;
  return windows;
}

describe("useTangentProjectWindows", () => {
  it("docks Projects on the left and the project card in the right-hand popover", () => {
    const windows = dockedStore();

    renderHook(() => useTangentProjectWindows());

    expect(windows.getDockedWindowOrder("left")).toEqual([PROJECTS_WINDOW_ID]);
    expect(windows.getDockedWindowOrder("right")).toEqual([
      PROJECT_CARD_WINDOW_ID,
    ]);
  });

  it("keeps the project card from being hidden or closed", () => {
    const windows = dockedStore();

    renderHook(() => useTangentProjectWindows());

    const card = windows.getWindowById(PROJECT_CARD_WINDOW_ID);
    expect(card?.isActionDisabled("hide")).toBe(true);
    expect(card?.isActionDisabled("close")).toBe(true);
  });

  it("leaves the windows the saved layout already restored", () => {
    const windows = dockedStore();
    windows.openWindow(createElement("span"), {
      id: PROJECTS_WINDOW_ID,
      title: "Projects",
      defaultDockState: "right",
    });
    windows.openWindow(createElement("span"), {
      id: PROJECT_CARD_WINDOW_ID,
      title: "Assets",
      defaultDockState: "left",
    });
    const openWindow = vi.spyOn(windows, "openWindow");

    renderHook(() => useTangentProjectWindows());

    expect(openWindow).not.toHaveBeenCalled();
    expect(windows.getDockedWindowOrder("left")).toEqual([
      PROJECT_CARD_WINDOW_ID,
    ]);
  });
});
