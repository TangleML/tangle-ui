import { describe, expect, it } from "vitest";

import { buildRunViewModeSearch, resolveRunViewMode } from "./useRunViewMode";

describe("resolveRunViewMode", () => {
  it("uses timing mode when the beta is enabled and requested", () => {
    expect(resolveRunViewMode({ view: "timing" }, true)).toBe("timing");
  });

  it("falls back to graph mode when the beta is disabled", () => {
    expect(resolveRunViewMode({ view: "timing" }, false)).toBe("graph");
  });

  it("falls back to graph mode for unsupported values", () => {
    expect(resolveRunViewMode({ view: "unknown" }, true)).toBe("graph");
  });
});

describe("buildRunViewModeSearch", () => {
  it("preserves other search state when opening timing mode", () => {
    expect(buildRunViewModeSearch({ nodeId: "task-a" }, "timing")).toEqual({
      nodeId: "task-a",
      view: "timing",
    });
  });

  it("removes only the view value when returning to the graph", () => {
    expect(
      buildRunViewModeSearch({ nodeId: "task-a", view: "timing" }, "graph"),
    ).toEqual({ nodeId: "task-a" });
  });
});
