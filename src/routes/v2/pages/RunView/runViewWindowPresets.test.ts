import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import {
  RUN_AI_ASSISTANT_WINDOW_ID,
  RUN_DEFAULT_VIEW_PRESET,
  RUN_DETAILS_WINDOW_ID,
  RUN_TOOLS_WINDOW_ID,
  RUN_VIEW_PRESETS,
} from "./runViewWindowPresets";

const stubContent = createElement("span");

function createRunWindowStore() {
  const store = new WindowStoreImpl();
  store.enableDockSide("left");
  store.enableDockSide("right");

  for (const id of [
    RUN_TOOLS_WINDOW_ID,
    RUN_DETAILS_WINDOW_ID,
    RUN_AI_ASSISTANT_WINDOW_ID,
  ]) {
    store.openWindow(stubContent, { id, title: id, persisted: true });
  }

  return store;
}

describe("run view window presets", () => {
  it("docks the default run windows on their intended sides", () => {
    const store = createRunWindowStore();

    store.applyViewPreset(RUN_DEFAULT_VIEW_PRESET);

    expect(store.getDockAreaWindowIds("left")).toEqual([
      RUN_TOOLS_WINDOW_ID,
      RUN_AI_ASSISTANT_WINDOW_ID,
    ]);
    expect(store.getDockAreaWindowIds("right")).toEqual([
      RUN_DETAILS_WINDOW_ID,
    ]);
  });

  it("hides all run windows with the minimal preset", () => {
    const store = createRunWindowStore();
    const minimalPreset = RUN_VIEW_PRESETS.find(
      (preset) => preset.label === "Minimal",
    );

    expect(minimalPreset).toBeDefined();
    if (!minimalPreset) throw new Error("Missing minimal run view preset");
    store.applyViewPreset(minimalPreset);

    expect(
      store.getAllWindows().every((window) => window.state === "hidden"),
    ).toBe(true);
  });
});
