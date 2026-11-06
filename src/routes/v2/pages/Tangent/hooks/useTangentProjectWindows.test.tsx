import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import {
  AGENTS_WINDOW_ID,
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

vi.mock("@/routes/v2/pages/Tangent/components/AgentsWindowContent", () => ({
  AgentsWindowContent: () => null,
}));

function dockedStore() {
  const windows = new WindowStoreImpl();
  windows.enableDockSide("left");
  stores.windows = windows;
  return windows;
}

describe("useTangentProjectWindows", () => {
  /** The rest live in a card over the canvas, so an editor's rail is the only one. */
  it("docks the Projects panel above the Agents panel, on the left", () => {
    const windows = dockedStore();

    renderHook(() => useTangentProjectWindows());

    expect(windows.getDockedWindowOrder("left")).toEqual([
      PROJECTS_WINDOW_ID,
      AGENTS_WINDOW_ID,
    ]);
  });

  it("leaves a Projects panel the saved layout already restored", () => {
    const windows = dockedStore();
    windows.openWindow(createElement("span"), {
      id: PROJECTS_WINDOW_ID,
      title: "Projects",
      defaultDockState: "left",
    });
    const openWindow = vi.spyOn(windows, "openWindow");

    renderHook(() => useTangentProjectWindows());

    expect(openWindow.mock.calls.map(([, options]) => options.id)).toEqual([
      AGENTS_WINDOW_ID,
    ]);
  });
});
