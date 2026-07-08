import { describe, expect, it } from "vitest";

import { parseRecent, type RecentItem } from "./useRecentlyViewed";

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
