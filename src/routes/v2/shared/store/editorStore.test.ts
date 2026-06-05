import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorStore } from "./editorStore";

describe("EditorStore.setSpotlightNode", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets the spotlight and auto-clears it after the reveal animation", () => {
    const store = new EditorStore();

    store.setSpotlightNode("task-1");
    expect(store.spotlightNodeId).toBe("task-1");

    vi.advanceTimersByTime(1300);
    expect(store.spotlightNodeId).toBeNull();
  });

  it("resets the timer when the spotlight target changes", () => {
    const store = new EditorStore();

    store.setSpotlightNode("a");
    vi.advanceTimersByTime(1000);
    store.setSpotlightNode("b");

    // Only 1000ms since "b" was set — still spotlit.
    vi.advanceTimersByTime(1000);
    expect(store.spotlightNodeId).toBe("b");

    vi.advanceTimersByTime(300);
    expect(store.spotlightNodeId).toBeNull();
  });

  it("clearing cancels the pending timer", () => {
    const store = new EditorStore();

    store.setSpotlightNode("a");
    store.setSpotlightNode(null);
    expect(store.spotlightNodeId).toBeNull();

    vi.advanceTimersByTime(1300);
    expect(store.spotlightNodeId).toBeNull();
  });
});
