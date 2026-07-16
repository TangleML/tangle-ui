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

  it("getDockedWindowOrder drops ids that are no longer docked to the side", () => {
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

    // The read path reconciles against actual window state, so a ghost id with
    // no live window is filtered out (and cleaned up on the next save).
    expect(store.getDockedWindowOrder("left")).toEqual(["component-library"]);
  });

  it("restoreDockArea preserves persisted order when windows are created afterwards", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");

    // Restore runs before any window exists (real reload: useWindowPersistence
    // effect runs before the use*Window hooks that call openWindow).
    store.restoreDockArea("left", {
      width: 320,
      collapsed: false,
      windowOrder: ["runs-and-submission", "component-library", "history"],
    });

    // Windows are then opened in a different (creation) order.
    store.openWindow(stubContent, {
      id: "component-library",
      title: "Components",
      defaultDockState: "left",
    });
    store.openWindow(stubContent, {
      id: "history",
      title: "History",
      defaultDockState: "left",
    });
    store.openWindow(stubContent, {
      id: "runs-and-submission",
      title: "Runs",
      defaultDockState: "left",
    });

    expect(store.getDockAreaWindowIds("left")).toEqual([
      "runs-and-submission",
      "component-library",
      "history",
    ]);
    expect(store.getDockedWindowOrder("left")).toEqual([
      "runs-and-submission",
      "component-library",
      "history",
    ]);
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
