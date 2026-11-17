import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectSnapPreview,
  registerDockTargetElement,
  setDockTargetSide,
} from "./snapUtils";

function buttonAt(left: number, top: number): HTMLElement {
  const button = document.createElement("button");
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
    new DOMRect(left, top, 28, 28),
  );
  return button;
}

function previewAt(x: number, y: number) {
  return detectSnapPreview({
    windowId: "dragged",
    mousePosition: { x, y },
    dockAreaWindowIds: { left: [], right: [] },
    enabledDockSides: new Set(["left", "right"]),
  });
}

describe("dock targets", () => {
  afterEach(() => {
    setDockTargetSide("right", false);
    registerDockTargetElement("right", null);
  });

  it("drops a window over a dock's button into that dock", () => {
    setDockTargetSide("right", true);
    registerDockTargetElement("right", buttonAt(900, 10));

    expect(previewAt(910, 20)).toEqual({ type: "dock-target", side: "right" });
    expect(previewAt(600, 20)).toBeNull();
  });

  it("never docks a window to a button's side at the screen edge", () => {
    setDockTargetSide("right", true);
    registerDockTargetElement("right", buttonAt(900, 10));

    expect(previewAt(window.innerWidth - 1, 300)).toBeNull();
    expect(previewAt(0, 300)).toEqual({ type: "edge", side: "left" });
  });

  it("takes nothing on that side while its button isn't on screen", () => {
    setDockTargetSide("right", true);

    expect(previewAt(window.innerWidth - 1, 300)).toBeNull();
  });
});
