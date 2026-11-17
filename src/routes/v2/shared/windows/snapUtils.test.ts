import { describe, expect, it, vi } from "vitest";

import { detectSnapPreview } from "./snapUtils";

function buttonAt(left: number, top: number): HTMLElement {
  const button = document.createElement("button");
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
    new DOMRect(left, top, 28, 28),
  );
  return button;
}

function previewAt(x: number, y: number, rightDockButton?: HTMLElement) {
  const dockTargetElements = new Map<"left" | "right", HTMLElement>();
  if (rightDockButton) dockTargetElements.set("right", rightDockButton);
  return detectSnapPreview({
    windowId: "dragged",
    mousePosition: { x, y },
    dockAreaWindowIds: { left: [], right: [] },
    enabledDockSides: new Set(["left", "right"]),
    popoverDockSides: new Set(["right"]),
    dockTargetElements,
  });
}

describe("dock targets", () => {
  it("drops a window over a popover dock's button into that dock", () => {
    const button = buttonAt(900, 10);

    expect(previewAt(910, 20, button)).toEqual({
      type: "dock-target",
      side: "right",
    });
    expect(previewAt(600, 20, button)).toBeNull();
  });

  it("never docks a window to a popover dock's side at the screen edge", () => {
    const button = buttonAt(900, 10);

    expect(previewAt(window.innerWidth - 1, 300, button)).toBeNull();
    expect(previewAt(0, 300, button)).toEqual({ type: "edge", side: "left" });
  });

  it("takes nothing on that side while its button isn't on screen", () => {
    expect(previewAt(window.innerWidth - 1, 300)).toBeNull();
  });
});
