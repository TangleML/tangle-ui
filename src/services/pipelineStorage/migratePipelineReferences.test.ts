import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFavorites } from "@/hooks/useFavorites";
import {
  type RecentItem,
  useRecentlyUsed,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { migratePipelineReferences } from "./migratePipelineReferences";

const oldKey = "My local pipeline";
const newKey = "remote:https%3A%2F%2Fexample.com:pipeline-id";
const displayName = "My pipeline";
const recentKeys = ["Home/recently_viewed", "Home/recently_used"] as const;
const localRecent: RecentItem = {
  type: "pipeline",
  id: oldKey,
  name: "Previous name",
  timestamp: 200,
};
const otherRecent: RecentItem = {
  type: "pipeline",
  id: "another-pipeline",
  name: "Another pipeline",
  timestamp: 300,
};
const runRecent: RecentItem = {
  type: "run",
  id: oldKey,
  name: "Run with the same ID",
  timestamp: 100,
};

beforeEach(async () => {
  localStorage.clear();
  await LibraryDB.favorites.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("migratePipelineReferences", () => {
  it("moves only the pipeline favorite and preserves its human display name", async () => {
    const unrelated = [
      { type: "pipeline" as const, id: "another", name: "Another pipeline" },
      { type: "run" as const, id: oldKey, name: "Run with the same ID" },
    ];
    await LibraryDB.favorites.bulkPut([
      { type: "pipeline", id: oldKey, name: "Previous name" },
      ...unrelated,
    ]);

    await migratePipelineReferences(oldKey, newKey, displayName);

    expect(await LibraryDB.favorites.get(["pipeline", oldKey])).toBeUndefined();
    expect(await LibraryDB.favorites.toArray()).toEqual(
      expect.arrayContaining([
        ...unrelated,
        { type: "pipeline", id: newKey, name: displayName },
      ]),
    );
    expect(await LibraryDB.favorites.count()).toBe(3);
  });

  it.each(recentKeys)(
    "preserves ordering and timestamps in %s without changing other items",
    async (key) => {
      localStorage.setItem(
        key,
        JSON.stringify([otherRecent, localRecent, runRecent]),
      );

      await migratePipelineReferences(oldKey, newKey, displayName);

      expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
        otherRecent,
        { ...localRecent, id: newKey, name: displayName },
        runRecent,
      ]);
    },
  );

  it.each(["local", "remote"])(
    "deduplicates references while preserving the most recent %s view",
    async (mostRecent) => {
      await LibraryDB.favorites.bulkPut([
        { type: "pipeline", id: oldKey, name: "Previous local name" },
        { type: "pipeline", id: newKey, name: "Previous remote name" },
      ]);
      const latest: RecentItem = {
        ...localRecent,
        id: mostRecent === "local" ? oldKey : newKey,
        timestamp: 400,
      };
      const earlier: RecentItem = {
        ...localRecent,
        id: mostRecent === "local" ? newKey : oldKey,
      };
      localStorage.setItem(
        recentKeys[0],
        JSON.stringify([latest, otherRecent, earlier, runRecent]),
      );

      await migratePipelineReferences(oldKey, newKey, displayName);

      expect(await LibraryDB.favorites.toArray()).toEqual([
        { type: "pipeline", id: newKey, name: displayName },
      ]);
      expect(JSON.parse(localStorage.getItem(recentKeys[0])!)).toEqual([
        { ...latest, id: newKey, name: displayName },
        otherRecent,
        runRecent,
      ]);
    },
  );

  it("does not add missing favorites or history entries", async () => {
    localStorage.setItem(recentKeys[0], JSON.stringify([otherRecent]));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await migratePipelineReferences(oldKey, newKey, displayName);

    expect(await LibraryDB.favorites.count()).toBe(0);
    expect(localStorage.getItem(recentKeys[0])).toBe(
      JSON.stringify([otherRecent]),
    );
    expect(localStorage.getItem(recentKeys[1])).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("is idempotent without recording another visit", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: oldKey,
      name: displayName,
    });
    localStorage.setItem(recentKeys[0], JSON.stringify([localRecent]));

    await migratePipelineReferences(oldKey, newKey, displayName);
    const firstMigration = localStorage.getItem(recentKeys[0]);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await migratePipelineReferences(oldKey, newKey, displayName);

    expect(await LibraryDB.favorites.toArray()).toEqual([
      { type: "pipeline", id: newKey, name: displayName },
    ]);
    expect(localStorage.getItem(recentKeys[0])).toBe(firstMigration);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not delete references when the source and destination are equal", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: oldKey,
      name: displayName,
    });
    localStorage.setItem(recentKeys[0], JSON.stringify([localRecent]));

    await migratePipelineReferences(oldKey, oldKey, displayName);

    expect(await LibraryDB.favorites.count()).toBe(1);
    expect(JSON.parse(localStorage.getItem(recentKeys[0])!)).toEqual([
      localRecent,
    ]);
  });

  it("updates mounted favorite and recent hooks", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: oldKey,
      name: displayName,
    });
    for (const key of recentKeys) {
      localStorage.setItem(key, JSON.stringify([localRecent]));
    }
    const { result } = renderHook(() => ({
      ...useFavorites(),
      ...useRecentlyViewed(),
      ...useRecentlyUsed(),
    }));
    await waitFor(() => expect(result.current.favorites).toHaveLength(1));

    await act(() => migratePipelineReferences(oldKey, newKey, displayName));

    await waitFor(() => {
      expect(result.current.isFavorite("pipeline", newKey)).toBe(true);
      expect(result.current.isFavorite("pipeline", oldKey)).toBe(false);
      expect(result.current.recentlyViewed).toEqual([
        { ...localRecent, id: newKey, name: displayName },
      ]);
      expect(result.current.recentlyUsed).toEqual([
        { ...localRecent, id: newKey, name: displayName },
      ]);
    });
  });

  it("rolls back both favorite writes if the favorite move fails", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: oldKey,
      name: displayName,
    });
    localStorage.setItem(recentKeys[0], JSON.stringify([localRecent]));
    vi.spyOn(LibraryDB.favorites, "delete").mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );

    await expect(
      migratePipelineReferences(oldKey, newKey, displayName),
    ).rejects.toThrow("Storage unavailable");

    expect(await LibraryDB.favorites.toArray()).toEqual([
      { type: "pipeline", id: oldKey, name: displayName },
    ]);
    expect(JSON.parse(localStorage.getItem(recentKeys[0])!)).toEqual([
      localRecent,
    ]);
  });

  it("allows retry after a recent store fails following earlier successful moves", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: oldKey,
      name: displayName,
    });
    for (const key of recentKeys) {
      localStorage.setItem(key, JSON.stringify([localRecent]));
    }
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === recentKeys[1]) {
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      setItem.call(localStorage, key, value);
    });

    await expect(
      migratePipelineReferences(oldKey, newKey, displayName),
    ).rejects.toThrow("Storage full");
    expect(await LibraryDB.favorites.get(["pipeline", newKey])).toBeDefined();
    expect(JSON.parse(localStorage.getItem(recentKeys[0])!)).toEqual([
      { ...localRecent, id: newKey, name: displayName },
    ]);
    expect(JSON.parse(localStorage.getItem(recentKeys[1])!)).toEqual([
      localRecent,
    ]);

    vi.restoreAllMocks();
    await migratePipelineReferences(oldKey, newKey, displayName);

    expect(await LibraryDB.favorites.count()).toBe(1);
    for (const key of recentKeys) {
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
        { ...localRecent, id: newKey, name: displayName },
      ]);
    }
  });
});
