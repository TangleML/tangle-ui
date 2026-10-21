import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import {
  addRecentlyViewed,
  moveRecentPipelineToRemote,
  parseRecent,
  type RecentItem,
  removeRecentlyViewed,
  useRecentlyUsed,
  useRecentlyViewed,
} from "./useRecentlyViewed";

const backend = vi.hoisted(() => ({ backendUrl: "https://example.com" }));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: () => backend }));
beforeEach(() => {
  backend.backendUrl = "https://example.com";
});

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

describe("moveRecentPipelineToRemote", () => {
  beforeEach(() => localStorage.clear());

  it.each([5, 15, 35])(
    "merges existing remote history while keeping the latest visit (%s)",
    (timestamp) => {
      const items: RecentItem[] = [
        { type: "pipeline", id: "Other", name: "Other", timestamp: 40 },
        { type: "pipeline", id: "local-id", name: "Old name", timestamp: 30 },
        { type: "run", id: "Original", name: "Run", timestamp: 20 },
        { type: "pipeline", id: "Original", name: "Original", timestamp: 10 },
        {
          type: "remote-pipeline",
          id: "remote-id",
          name: "Stale name",
          timestamp,
        },
      ].sort((a, b) => b.timestamp - a.timestamp) as RecentItem[];
      for (const key of ["Home/recently_viewed", "Home/recently_used"]) {
        localStorage.setItem(key, JSON.stringify(items));
      }
      const { result } = renderHook(() => ({
        ...useRecentlyViewed(),
        ...useRecentlyUsed(),
      }));

      act(() =>
        moveRecentPipelineToRemote(["Original", "local-id"], {
          id: "remote-id",
          name: "Original",
          backendUrl: backend.backendUrl,
        }),
      );

      const expected = [
        items[0],
        {
          type: "pipeline",
          id: getRemotePipelineSavedId(backend.backendUrl, "remote-id"),
          name: "Original",
          timestamp: Math.max(30, timestamp),
        },
        { type: "run", id: "Original", name: "Run", timestamp: 20 },
      ];
      expect(result.current.recentlyViewed).toEqual(expected);
      expect(result.current.recentlyUsed).toEqual(expected);
      act(() =>
        moveRecentPipelineToRemote(["Original", "local-id"], {
          id: "remote-id",
          name: "Original",
          backendUrl: backend.backendUrl,
        }),
      );
      expect(result.current.recentlyViewed).toEqual(expected);
    },
  );
});

describe("removeRecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("scopes remote history and deletion to its original backend", () => {
    const item = {
      type: "remote-pipeline",
      id: "same-id",
      name: "Remote",
    } as const;
    addRecentlyViewed(item, backend.backendUrl);
    addRecentlyViewed(item, "https://other.example.com");
    const { result, rerender } = renderHook(() => useRecentlyViewed());
    expect(result.current.recentlyViewed.map((entry) => entry.id)).toEqual([
      getRemotePipelineSavedId(backend.backendUrl, item.id),
    ]);
    expect(
      parseRecent(localStorage.getItem("Home/recently_viewed")!).every(
        (entry) => entry.type === "pipeline",
      ),
    ).toBe(true);

    backend.backendUrl = "https://other.example.com";
    rerender();
    expect(result.current.recentlyViewed.map((entry) => entry.id)).toEqual([
      getRemotePipelineSavedId(backend.backendUrl, item.id),
    ]);
    act(() => removeRecentlyViewed(item.type, item.id, backend.backendUrl));
    expect(result.current.recentlyViewed).toEqual([]);
    backend.backendUrl = "https://example.com";
    rerender();
    expect(result.current.recentlyViewed).toHaveLength(1);
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
