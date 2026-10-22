import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { getRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import { type FavoriteItem, useFavorites } from "./useFavorites";

const backend = vi.hoisted(() => ({ backendUrl: "https://example.com" }));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: () => backend }));
beforeEach(() => {
  backend.backendUrl = "https://example.com";
});

function scoped(item: FavoriteItem): FavoriteItem {
  return {
    ...item,
    type: "pipeline",
    id: getRemotePipelineSavedId(backend.backendUrl, item.id),
  };
}

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
  it("keeps equal remote IDs separate across backends and removes only the selected backend's favorite", async () => {
    const item: FavoriteItem = {
      type: "pipeline",
      id: "same-id",
      name: "Remote",
    };
    const { result, rerender } = renderHook(() => useFavorites());
    await result.current.addFavorite(item);
    await waitFor(() =>
      expect(result.current.isFavorite(item.type, item.id)).toBe(true),
    );
    expect(await LibraryDB.favorites.toArray()).toEqual([
      { ...scoped(item), sortKey: -1 },
    ]);

    backend.backendUrl = "https://other.example.com";
    rerender();
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite(item.type, item.id)).toBe(false);
    await result.current.addFavorite(item);
    await waitFor(() =>
      expect(result.current.isFavorite(item.type, item.id)).toBe(true),
    );
    expect(await LibraryDB.favorites.count()).toBe(2);
    await result.current.removeFavorite(item.type, item.id);
    await waitFor(() => expect(result.current.favorites).toEqual([]));

    backend.backendUrl = "https://example.com/";
    rerender();
    expect(result.current.isFavorite(item.type, item.id)).toBe(true);
    expect(await LibraryDB.favorites.count()).toBe(1);
  });

  it("cleans up the captured backend after the active backend changes", async () => {
    const item: FavoriteItem = {
      type: "pipeline",
      id: "same-id",
      name: "Remote",
    };
    const originalBackend = backend.backendUrl;
    const { result, rerender } = renderHook(() => useFavorites());
    await result.current.addFavorite(item);
    backend.backendUrl = "https://other.example.com";
    rerender();
    await result.current.addFavorite(item);

    await result.current.removeFavorite(item.type, item.id, originalBackend);

    await waitFor(() =>
      expect(result.current.isFavorite(item.type, item.id)).toBe(true),
    );
    expect(await LibraryDB.favorites.toArray()).toEqual([
      { ...scoped(item), sortKey: -1 },
    ]);
  });

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
      expect(result.current.favorites).toEqual([scoped(pipeline)]);
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
      expect(result.current.favorites).toEqual([scoped(pipeline)]);
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

  /**
   * A project reached by a shared link is on no server-side list of the
   * caller's, so starring it is the only thing that keeps it findable.
   */
  it("keeps a project, which no list would otherwise hold", async () => {
    const project: FavoriteItem = {
      type: "project",
      id: "proj-1",
      name: "Ada's churn model",
    };
    const { result } = renderHook(() => useFavorites());

    await result.current.addFavorite(project);

    await waitFor(() => {
      expect(result.current.favorites).toEqual([project]);
      expect(result.current.isFavorite("project", "proj-1")).toBe(true);
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

  it("keeps favorite order when updating a saved pipeline's label", async () => {
    await LibraryDB.favorites.bulkPut([
      { ...run, sortKey: 1 },
      { ...scoped(pipeline), sortKey: 2 },
    ]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() =>
      expect(result.current.favorites).toEqual([run, scoped(pipeline)]),
    );
    await result.current.addFavorite({ ...pipeline, name: "Renamed" });
    await waitFor(() =>
      expect(result.current.favorites).toEqual([
        run,
        { ...scoped(pipeline), name: "Renamed" },
      ]),
    );
  });

  it("omits obsolete local pipeline entries", async () => {
    await LibraryDB.favorites.bulkPut([pipeline, run]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favorites).toEqual([run]));
  });
});

it("recognizes and removes an existing favorite after equivalent backend URL spelling changes", async () => {
  const oldId = `remote:${encodeURIComponent("https://EXAMPLE.com:443/")}:pipeline-id`;
  await LibraryDB.favorites.put({ type: "pipeline", id: oldId, name: "Saved" });
  const { result } = renderHook(() => useFavorites());
  await waitFor(() =>
    expect(result.current.isFavorite("pipeline", "pipeline-id")).toBe(true),
  );
  await act(() =>
    result.current.toggleFavorite({
      type: "pipeline",
      id: "pipeline-id",
      name: "Saved",
    }),
  );
  await waitFor(() => expect(result.current.favorites).toHaveLength(0));
  expect(await LibraryDB.favorites.count()).toBe(0);
});
