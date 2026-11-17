import { fireEvent, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IS_MAC } from "@/routes/v2/shared/shortcuts/keys";
import type { DockState } from "@/routes/v2/shared/windows/types";
import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import { useFindProjectCard } from "./useFindProjectCard";
import { requestProjectSearchFocus } from "./useProjectSearchFocus";
import { PROJECT_CARD_WINDOW_ID } from "./useTangentProjectWindows";

const stores = vi.hoisted(() => ({
  windows: undefined as WindowStoreImpl | undefined,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: stores.windows }),
}));

vi.mock("./useProjectSearchFocus", () => ({
  requestProjectSearchFocus: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/components/ProjectsWindowContent", () => ({
  ProjectsWindowContent: () => null,
}));

vi.mock("@/routes/v2/pages/Tangent/components/ProjectCardContent", () => ({
  ProjectCardContent: () => null,
}));

function pressShortcut() {
  fireEvent.keyDown(window, {
    key: "k",
    ...(IS_MAC ? { metaKey: true } : { ctrlKey: true }),
  });
}

function cardDocked(dockState: DockState) {
  const windows = new WindowStoreImpl();
  windows.enableDockSide("left");
  windows.enableDockSide("right");
  windows.openWindow(createElement("span"), {
    id: PROJECT_CARD_WINDOW_ID,
    title: "Assets",
    ...(dockState === "none" ? {} : { defaultDockState: dockState }),
  });
  stores.windows = windows;
  renderHook(() => useFindProjectCard());
  return windows;
}

describe("useFindProjectCard", () => {
  beforeEach(() => vi.mocked(requestProjectSearchFocus).mockClear());
  afterEach(() => document.body.replaceChildren());

  it("opens and closes the popover while the card is in it", () => {
    const windows = cardDocked("right");

    pressShortcut();
    expect(windows.isDockPopoverOpen("right")).toBe(true);
    expect(requestProjectSearchFocus).toHaveBeenCalledTimes(1);

    pressShortcut();
    expect(windows.isDockPopoverOpen("right")).toBe(false);
  });

  it("unfolds the card in the left dock and asks for its search", () => {
    const windows = cardDocked("left");
    windows.getWindowById(PROJECT_CARD_WINDOW_ID)?.minimize();
    windows.setDockAreaCollapsed("left", true);

    pressShortcut();

    expect(windows.getDockAreaConfig("left").collapsed).toBe(false);
    expect(windows.getWindowById(PROJECT_CARD_WINDOW_ID)?.isMinimized).toBe(
      false,
    );
    expect(requestProjectSearchFocus).toHaveBeenCalledTimes(1);
    expect(windows.isDockPopoverOpen("right")).toBe(false);
  });

  it("brings a floating card in front of other windows", () => {
    const windows = cardDocked("none");
    windows.openWindow(createElement("span"), { id: "other", title: "Other" });
    expect(windows.isWindowAtFront(PROJECT_CARD_WINDOW_ID)).toBe(false);

    pressShortcut();

    expect(windows.isWindowAtFront(PROJECT_CARD_WINDOW_ID)).toBe(true);
  });

  it("leaves the key to an open dialog", () => {
    const windows = cardDocked("right");
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog);

    pressShortcut();

    expect(windows.isDockPopoverOpen("right")).toBe(false);
    expect(requestProjectSearchFocus).not.toHaveBeenCalled();
  });
});
