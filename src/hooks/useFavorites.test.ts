import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { type FavoriteItem, useFavorites } from "./useFavorites";

const pipeline: FavoriteItem = {
  type: "pipeline",
  id: "p1",
  name: "My Pipeline",
};
const run: FavoriteItem = { type: "run", id: "r1", name: "My Run" };

beforeEach(() => {
  localStorage.clear();
});

describe("useFavorites", () => {
  it("starts with no favorites", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it("adds a favorite", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.addFavorite(pipeline);
    });

    expect(result.current.favorites).toEqual([pipeline]);
  });

  it("does not add a duplicate favorite", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.addFavorite(pipeline);
      result.current.addFavorite(pipeline);
    });

    expect(result.current.favorites).toHaveLength(1);
  });

  it("removes a favorite", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.addFavorite(pipeline);
      result.current.addFavorite(run);
    });

    act(() => {
      result.current.removeFavorite("pipeline", "p1");
    });

    expect(result.current.favorites).toEqual([run]);
  });

  it("toggles a favorite on and off", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.toggleFavorite(pipeline);
    });
    expect(result.current.favorites).toEqual([pipeline]);

    act(() => {
      result.current.toggleFavorite(pipeline);
    });
    expect(result.current.favorites).toEqual([]);
  });

  it("correctly reports isFavorite", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.addFavorite(pipeline);
    });

    expect(result.current.isFavorite("pipeline", "p1")).toBe(true);
    expect(result.current.isFavorite("run", "r1")).toBe(false);
  });

  it("does not confuse items of different types with the same id", () => {
    const pipelineItem: FavoriteItem = {
      type: "pipeline",
      id: "1",
      name: "Pipeline",
    };
    const runItem: FavoriteItem = { type: "run", id: "1", name: "Run" };
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.addFavorite(pipelineItem);
    });

    expect(result.current.isFavorite("pipeline", "1")).toBe(true);
    expect(result.current.isFavorite("run", "1")).toBe(false);

    act(() => {
      result.current.addFavorite(runItem);
    });

    expect(result.current.favorites).toHaveLength(2);
  });

  it("reacts to storage events from other windows", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      // In a real browser, another tab both updates localStorage and fires the
      // storage event. jsdom only does the latter, so we simulate both.
      localStorage.setItem("Home/favorites", JSON.stringify([pipeline]));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "Home/favorites",
          newValue: JSON.stringify([pipeline]),
        }),
      );
    });

    expect(result.current.favorites).toEqual([pipeline]);
  });
});
