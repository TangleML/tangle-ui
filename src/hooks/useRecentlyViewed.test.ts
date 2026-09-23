import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addRecentlyViewed,
  parseRecent,
  type RecentItem,
  removeRecentlyViewed,
  useRecentlyViewed,
} from "./useRecentlyViewed";

describe("parseRecent", () => {
  it("keeps well-formed items", () => {
    const items: RecentItem[] = [
      { type: "pipeline", id: "p1", name: "Pipeline", timestamp: 1 },
      { type: "component", id: "c1", name: "Component", timestamp: 2 },
      { type: "tour", id: "t1", name: "Tour", timestamp: 3 },
    ];
    expect(parseRecent(JSON.stringify(items))).toEqual(items);
  });

  it("drops entries with an unsupported type", () => {
    const json = JSON.stringify([
      { type: "other", id: "x", name: "X", timestamp: 1 },
    ]);
    expect(parseRecent(json)).toEqual([]);
  });

  it("drops entries with non-string id or name", () => {
    const json = JSON.stringify([
      { type: "run", id: null, name: {}, timestamp: 1 },
    ]);
    expect(parseRecent(json)).toEqual([]);
  });

  it("drops entries with a non-finite or non-numeric timestamp", () => {
    const json = JSON.stringify([
      { type: "run", id: "r1", name: "Run", timestamp: "bad" },
      { type: "run", id: "r2", name: "Run", timestamp: null },
    ]);
    expect(parseRecent(json)).toEqual([]);
  });

  it("drops legacy entries that use viewedAt instead of timestamp", () => {
    const json = JSON.stringify([
      { type: "run", id: "r1", name: "Run", viewedAt: 1 },
    ]);
    expect(parseRecent(json)).toEqual([]);
  });

  it("returns an empty array for invalid JSON or non-array data", () => {
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent(JSON.stringify({ not: "an array" }))).toEqual([]);
  });
});

describe("removeRecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /** A link to a deleted project is offered, clicked, and lands nowhere. */
  it("forgets the entry for something that no longer exists", () => {
    addRecentlyViewed({ type: "project", id: "p1", name: "Doomed" });
    addRecentlyViewed({ type: "project", id: "p2", name: "Kept" });

    removeRecentlyViewed("project", "p1");

    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.recentlyViewed.map((item) => item.id)).toEqual([
      "p2",
    ]);
  });

  it("leaves a different type with the same id alone", () => {
    addRecentlyViewed({ type: "pipeline", id: "shared-id", name: "Pipeline" });
    addRecentlyViewed({ type: "project", id: "shared-id", name: "Project" });

    removeRecentlyViewed("project", "shared-id");

    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.recentlyViewed).toHaveLength(1);
    expect(result.current.recentlyViewed[0].type).toBe("pipeline");
  });

  /** `storage` events reach the other tabs, never the one that wrote. */
  it("updates a list already on screen in this tab", () => {
    addRecentlyViewed({ type: "project", id: "p1", name: "Doomed" });
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.recentlyViewed).toHaveLength(1);

    act(() => removeRecentlyViewed("project", "p1"));

    expect(result.current.recentlyViewed).toEqual([]);
  });

  it("says nothing when there was no such entry", () => {
    addRecentlyViewed({ type: "project", id: "p1", name: "Kept" });
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => removeRecentlyViewed("project", "absent"));

    expect(result.current.recentlyViewed).toHaveLength(1);
  });
});
