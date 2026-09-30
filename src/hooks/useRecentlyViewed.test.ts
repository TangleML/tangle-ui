import { afterEach, describe, expect, it } from "vitest";

import {
  addRecentlyUsed,
  addRecentlyViewed,
  parseRecent,
  type RecentItem,
} from "./useRecentlyViewed";

afterEach(() => localStorage.clear());

describe.each([
  ["Home/recently_viewed", addRecentlyViewed],
  ["Home/recently_used", addRecentlyUsed],
] as const)("%s pipeline identities", (key, addRecent) => {
  it.each([
    "Daily report",
    "remote:https%3A%2F%2Fbackend.example:pipeline-id",
    "pending:account-a:draft.yaml",
  ])("replaces legacy and stable duplicates for %s", (pipelineReferenceId) => {
    const stable = {
      type: "pipeline" as const,
      id: "document-id",
      name: "Daily report",
      pipelineReferenceId,
    };
    localStorage.setItem(
      key,
      JSON.stringify([
        { ...stable, timestamp: 2 },
        {
          type: "pipeline",
          id: pipelineReferenceId,
          name: "Old name",
          timestamp: 1,
        },
      ]),
    );

    addRecent(stable);

    expect(parseRecent(localStorage.getItem(key) ?? "[]")).toEqual([
      { ...stable, timestamp: expect.any(Number) },
    ]);
  });

  it("preserves records of another type, backend, or account", () => {
    const reference = "pending:account-a:draft.yaml";
    const unrelated: RecentItem[] = [
      { type: "run", id: reference, name: "Daily report", timestamp: 4 },
      {
        type: "pipeline",
        id: "pending:account-b:draft.yaml",
        name: "Daily report",
        timestamp: 3,
      },
      {
        type: "pipeline",
        id: reference,
        pipelineReferenceId: "remote:other-backend:pipeline-id",
        name: "Daily report",
        timestamp: 2,
      },
      {
        type: "pipeline",
        id: "other-document-id",
        name: "Daily report",
        timestamp: 1,
      },
    ];
    localStorage.setItem(key, JSON.stringify(unrelated));

    addRecent({
      type: "pipeline",
      id: "document-id",
      name: "Daily report",
      pipelineReferenceId: reference,
    });

    const stored = parseRecent(localStorage.getItem(key) ?? "[]");
    expect(stored).toHaveLength(unrelated.length + 1);
    expect(stored.slice(1)).toEqual(unrelated);
  });
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
