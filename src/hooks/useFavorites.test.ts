import "fake-indexeddb/auto";

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { type FavoriteItem, useFavorites } from "./useFavorites";

const pipeline: FavoriteItem = {
  type: "pipeline",
  id: "p1",
  name: "My Pipeline",
};
const run: FavoriteItem = { type: "run", id: "r1", name: "My Run" };

afterEach(async () => {
  await LibraryDB.favorites.clear();
});

describe("useFavorites", () => {
  it("starts with no favorites", async () => {
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => {
      expect(result.current.favorites).toEqual([]);
    });
  });

  it("adds a favorite", async () => {
    const { result } = renderHook(() => useFavorites());
    await result.current.addFavorite(pipeline);
    await waitFor(() => {
      expect(result.current.favorites).toEqual([pipeline]);
    });
  });

  it("does not add a duplicate favorite", async () => {
    const { result } = renderHook(() => useFavorites());
    await result.current.addFavorite(pipeline);
    await result.current.addFavorite(pipeline);
    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(1);
    });
  });

  it("removes a favorite", async () => {
    const { result } = renderHook(() => useFavorites());
    await result.current.addFavorite(pipeline);
    await result.current.addFavorite(run);
    await result.current.removeFavorite("pipeline", "p1");
    await waitFor(() => {
      expect(result.current.favorites).toEqual([run]);
    });
  });

  it("toggles a favorite on and off", async () => {
    const { result } = renderHook(() => useFavorites());
    await result.current.toggleFavorite(pipeline);
    await waitFor(() => {
      expect(result.current.favorites).toEqual([pipeline]);
    });
    await result.current.toggleFavorite(pipeline);
    await waitFor(() => {
      expect(result.current.favorites).toEqual([]);
    });
  });

  it("correctly reports isFavorite", async () => {
    const { result } = renderHook(() => useFavorites());
    await result.current.addFavorite(pipeline);
    await waitFor(() => {
      expect(result.current.isFavorite("pipeline", "p1")).toBe(true);
      expect(result.current.isFavorite("run", "r1")).toBe(false);
    });
  });

  it("does not confuse items of different types with the same id", async () => {
    const pipelineItem: FavoriteItem = {
      type: "pipeline",
      id: "1",
      name: "Pipeline",
    };
    const runItem: FavoriteItem = { type: "run", id: "1", name: "Run" };
    const { result } = renderHook(() => useFavorites());

    await result.current.addFavorite(pipelineItem);
    await waitFor(() => {
      expect(result.current.isFavorite("pipeline", "1")).toBe(true);
      expect(result.current.isFavorite("run", "1")).toBe(false);
    });

    await result.current.addFavorite(runItem);
    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(2);
    });
  });
});
