import { describe, expect, it } from "vitest";

import type { TourStep } from "@/components/Learn/tours/registry";

import {
  COMPONENT_SEARCH_V2_WINDOW_ID,
  componentWindowIdForFlag,
  LEGACY_COMPONENT_WINDOW_ID,
  resolveComponentWindowSteps,
} from "./resolveComponentWindowSteps";

const steps: TourStep[] = [
  {
    selector: '[data-dock-window-content="component-library"]',
    highlightedSelectors: [
      '[data-dock-window="component-library"]',
      '[data-dock-window-content="component-library"]',
    ],
    mutationObservables: ['[data-dock-window-content="component-library"]'],
    resizeObservables: ['[data-dock-window-content="component-library"]'],
    ensureWindowRestored: "component-library",
    content: "Add a component",
  },
  {
    selector: '[data-folder-name="Standard library"]',
    targetWindowId: "context-panel",
    content: "Unrelated step",
  },
];

describe("componentWindowIdForFlag", () => {
  it("maps the flag to the active window id", () => {
    expect(componentWindowIdForFlag(false)).toBe(LEGACY_COMPONENT_WINDOW_ID);
    expect(componentWindowIdForFlag(true)).toBe(COMPONENT_SEARCH_V2_WINDOW_ID);
  });
});

describe("resolveComponentWindowSteps", () => {
  it("returns the steps untouched for the legacy window id", () => {
    expect(resolveComponentWindowSteps(steps, LEGACY_COMPONENT_WINDOW_ID)).toBe(
      steps,
    );
  });

  it("rewrites every component-window reference to the v2 id", () => {
    const [first] = resolveComponentWindowSteps(
      steps,
      COMPONENT_SEARCH_V2_WINDOW_ID,
    );

    expect(first.selector).toBe(
      '[data-dock-window-content="component-search-v2"]',
    );
    expect(first.highlightedSelectors).toEqual([
      '[data-dock-window="component-search-v2"]',
      '[data-dock-window-content="component-search-v2"]',
    ]);
    expect(first.mutationObservables).toEqual([
      '[data-dock-window-content="component-search-v2"]',
    ]);
    expect(first.resizeObservables).toEqual([
      '[data-dock-window-content="component-search-v2"]',
    ]);
    expect(first.ensureWindowRestored).toBe("component-search-v2");
  });

  it("leaves unrelated selectors and window ids alone", () => {
    const [, second] = resolveComponentWindowSteps(
      steps,
      COMPONENT_SEARCH_V2_WINDOW_ID,
    );

    expect(second.selector).toBe('[data-folder-name="Standard library"]');
    expect(second.targetWindowId).toBe("context-panel");
  });
});
