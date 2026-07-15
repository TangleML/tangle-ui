import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { WindowStoreImpl } from "./windowStore";

const stubContent = createElement("span");

describe("WindowStoreImpl dock order reconciliation", () => {
  it("restoreDockArea keeps a docked window that the persisted order omits", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");

    store.openWindow(stubContent, {
      id: "component-library",
      title: "Components",
      defaultDockState: "left",
    });
    store.openWindow(stubContent, {
      id: "tip-of-the-day",
      title: "Tip",
      defaultDockState: "left",
    });

    // Simulate persisted layout saved before "tip-of-the-day" existed.
    store.restoreDockArea("left", {
      width: 320,
      collapsed: false,
      windowOrder: ["component-library"],
    });

    expect(store.getDockAreaWindowIds("left")).toEqual([
      "component-library",
      "tip-of-the-day",
    ]);
  });

  it("restoreDockArea drops ids that are no longer docked to the side", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");

    store.openWindow(stubContent, {
      id: "component-library",
      title: "Components",
      defaultDockState: "left",
    });

    store.restoreDockArea("left", {
      width: 320,
      collapsed: false,
      windowOrder: ["component-library", "ghost-window"],
    });

    expect(store.getDockAreaWindowIds("left")).toEqual(["component-library"]);
  });

  it("getDockedWindowOrder does not duplicate windows already in the order", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");

    store.openWindow(stubContent, {
      id: "component-library",
      title: "Components",
      defaultDockState: "left",
    });
    store.openWindow(stubContent, {
      id: "tip-of-the-day",
      title: "Tip",
      defaultDockState: "left",
    });

    expect(store.getDockedWindowOrder("left")).toEqual([
      "component-library",
      "tip-of-the-day",
    ]);
  });
});
