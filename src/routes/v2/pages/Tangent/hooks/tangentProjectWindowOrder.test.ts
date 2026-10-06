import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import {
  placeProjectDockWindows,
  PROJECT_DOCK_WINDOW_IDS,
  rememberedDockWindows,
} from "./tangentProjectWindowOrder";

const stub = createElement("span");

const SAVED_BEFORE_THE_PROJECT_WINDOW_EXISTED = [
  "tangent-project-sessions",
  "tangent-project-agents",
  "tangent-project-assets",
  "tangent-project-resources",
];

function open(store: WindowStoreImpl, id: string) {
  store.openWindow(stub, { id, title: id, defaultDockState: "left" });
}

/** What the Tangent page does on every mount: open all five, then order them. */
function mountProjectWindows(store: WindowStoreImpl) {
  const remembered = rememberedDockWindows(store);
  for (const id of PROJECT_DOCK_WINDOW_IDS) open(store, id);
  placeProjectDockWindows(store, remembered);
}

describe("the Tangent project dock order", () => {
  /**
   * A saved layout has no opinion about a window added after it was written, so
   * the reconcile that restores it files the newcomer last. The project window
   * belongs above the sessions, not under everything.
   */
  it("puts the project window first even for a layout that predates it", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");
    store.restoreDockArea("left", {
      width: 320,
      collapsed: false,
      windowOrder: SAVED_BEFORE_THE_PROJECT_WINDOW_EXISTED,
    });

    mountProjectWindows(store);

    expect(store.getDockedWindowOrder("left")).toEqual([
      ...PROJECT_DOCK_WINDOW_IDS,
    ]);
  });

  it("puts them in order for a browser that has never been here", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");

    mountProjectWindows(store);

    expect(store.getDockedWindowOrder("left")).toEqual([
      ...PROJECT_DOCK_WINDOW_IDS,
    ]);
  });

  /** A stack someone dragged into the order they want stays in that order. */
  it("leaves a saved layout that already knows every window alone", () => {
    const rearranged = [
      "tangent-project-resources",
      "tangent-project-details",
      "tangent-project-runs",
      "tangent-project-sessions",
      "tangent-project-assets",
      "tangent-project-agents",
    ];
    const store = new WindowStoreImpl();
    store.enableDockSide("left");
    store.restoreDockArea("left", {
      width: 320,
      collapsed: false,
      windowOrder: rearranged,
    });

    mountProjectWindows(store);

    expect(store.getDockedWindowOrder("left")).toEqual(rearranged);
  });

  /** A window the user dragged to the right is theirs to keep there. */
  it("leaves a window that is no longer docked left alone", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");
    store.enableDockSide("right");

    const remembered = rememberedDockWindows(store);
    for (const id of PROJECT_DOCK_WINDOW_IDS) open(store, id);
    store.dockWindow("tangent-project-assets", "right");
    placeProjectDockWindows(store, remembered);

    expect(store.getDockedWindowOrder("left")).toEqual(
      PROJECT_DOCK_WINDOW_IDS.filter((id) => id !== "tangent-project-assets"),
    );
    expect(store.getDockedWindowOrder("right")).toEqual([
      "tangent-project-assets",
    ]);
  });
});
