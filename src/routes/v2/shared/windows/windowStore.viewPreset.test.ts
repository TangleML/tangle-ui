import { runInAction } from "mobx";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { DEFAULT_DOCK_AREAS, DEFAULT_VIEW_PRESET } from "./viewPresets";
import { WindowStoreImpl } from "./windowStore";

const stubContent = createElement("span");

describe("WindowStoreImpl view preset dock layout", () => {
  it("seedInitialDockLayoutFromPreset applies DEFAULT_DOCK_AREAS stack order on the left", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");
    store.enableDockSide("right");

    store.openWindow(stubContent, {
      id: "component-library",
      title: "Components",
      defaultDockState: "left",
    });
    store.openWindow(stubContent, {
      id: "runs-and-submission",
      title: "Runs",
      defaultDockState: "left",
    });

    expect(store.getDockAreaWindowIds("left")).toEqual([
      "component-library",
      "runs-and-submission",
    ]);

    store.seedInitialDockLayoutFromPreset(DEFAULT_VIEW_PRESET);

    expect(store.getDockAreaWindowIds("left")).toEqual(
      DEFAULT_DOCK_AREAS.left.filter((id) => store.getWindowById(id)),
    );
  });

  it("applyViewPreset does not replace dock windowOrder when sides already match preset", () => {
    const store = new WindowStoreImpl();
    store.enableDockSide("left");
    store.enableDockSide("right");

    store.openWindow(stubContent, {
      id: "component-library",
      title: "Components",
      defaultDockState: "left",
    });
    store.openWindow(stubContent, {
      id: "runs-and-submission",
      title: "Runs",
      defaultDockState: "left",
    });

    runInAction(() => {
      store.dockAreas.left.windowOrder = [
        "component-library",
        "runs-and-submission",
      ];
    });

    store.applyViewPreset(DEFAULT_VIEW_PRESET);

    expect(store.getDockAreaWindowIds("left")).toEqual([
      "component-library",
      "runs-and-submission",
    ]);
  });
});
