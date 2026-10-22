import { expect, it, vi } from "vitest";

import { detectSnapPreview } from "./snapUtils";
import { WindowStoreImpl } from "./windowStore";

function dockAt(x: number) {
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
    new DOMRect(x, 100, 200, 600),
  );
  return element;
}

it("uses only the dragging view's dock elements", () => {
  const first = new WindowStoreImpl();
  const second = new WindowStoreImpl();
  first.dockAreaElements.right = dockAt(800);
  second.dockAreaElements.right = dockAt(500);
  const options = {
    windowId: "details",
    mousePosition: { x: 650, y: 150 },
    dockAreaWindowIds: { left: [], right: [] },
    enabledDockSides: new Set(["right"] as const),
  };

  expect(
    detectSnapPreview({ ...options, dockAreaElements: first.dockAreaElements }),
  ).toBeNull();
  expect(
    detectSnapPreview({
      ...options,
      dockAreaElements: second.dockAreaElements,
    }),
  ).toMatchObject({
    type: "dock-insert",
    side: "right",
    areaLeft: 500,
  });
  first.dockAreaElements.right = null;
  expect(
    detectSnapPreview({
      ...options,
      dockAreaElements: second.dockAreaElements,
    }),
  ).toMatchObject({
    type: "dock-insert",
    areaLeft: 500,
  });
});
