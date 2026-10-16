import "fake-indexeddb/auto";

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { movePipelineAssociationsToRemote } from "@/services/pipelineStorage/pipelineAssociations";

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

  it.each(["A", "M", "Z"])(
    "keeps %s in its exact slot when its local identity becomes remote",
    async (id) => {
      const initial: FavoriteItem[] = [
        { type: "pipeline", id: "A", name: "First pipeline" },
        { type: "pipeline", id: "M", name: "Middle pipeline" },
        { type: "pipeline", id: "Z", name: "Last local pipeline" },
        { type: "remote-pipeline", id: "existing", name: "Existing remote" },
        run,
      ];
      await LibraryDB.favorites.bulkPut(initial);
      const { result, unmount } = renderHook(() => useFavorites());
      await waitFor(() => expect(result.current.favorites).toEqual(initial));
      const original = initial.find((item) => item.id === id)!;
      const remote = {
        type: "remote-pipeline",
        id: "uploaded-id",
        name: original.name,
      } satisfies FavoriteItem;
      const expected = initial.map((item) =>
        item === original ? remote : item,
      );

      await movePipelineAssociationsToRemote(
        { id: "local-file-id", storageKey: id },
        { id: remote.id, storageKey: remote.name },
      );

      await waitFor(() => expect(result.current.favorites).toEqual(expected));
      // Updating a favorite's label must also preserve its saved position.
      await result.current.addFavorite({
        type: remote.type,
        id: remote.id,
        name: remote.name,
      });
      await waitFor(() => expect(result.current.favorites).toEqual(expected));
      unmount();
      const reopened = renderHook(() => useFavorites());
      await waitFor(() =>
        expect(reopened.result.current.favorites).toEqual(expected),
      );
    },
  );

  it("preserves an existing stored order when the pipeline is last", async () => {
    await LibraryDB.favorites.bulkPut([
      { ...run, sortKey: 1 },
      { ...pipeline, sortKey: 2 },
    ]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() =>
      expect(result.current.favorites).toEqual([run, pipeline]),
    );

    await movePipelineAssociationsToRemote(
      { id: "local-file-id", storageKey: pipeline.id },
      { id: "uploaded-id", storageKey: pipeline.name },
    );

    await waitFor(() =>
      expect(result.current.favorites).toEqual([
        run,
        { ...pipeline, type: "remote-pipeline", id: "uploaded-id" },
      ]),
    );
  });

  it("keeps both positions when a local name is reused for another upload", async () => {
    const { result } = renderHook(() => useFavorites());
    await result.current.addFavorite(run);
    await result.current.addFavorite(pipeline);
    await waitFor(() =>
      expect(result.current.favorites).toEqual([pipeline, run]),
    );

    const first: FavoriteItem = {
      ...pipeline,
      type: "remote-pipeline",
      id: "first-upload",
    };
    await movePipelineAssociationsToRemote(
      { id: "first-local-id", storageKey: pipeline.id },
      { id: first.id, storageKey: first.name },
    );
    await waitFor(() => expect(result.current.favorites).toEqual([first, run]));

    await result.current.addFavorite(pipeline);
    await waitFor(() =>
      expect(result.current.favorites).toEqual([pipeline, first, run]),
    );
    const second: FavoriteItem = {
      ...pipeline,
      type: "remote-pipeline",
      id: "second-upload",
    };
    await movePipelineAssociationsToRemote(
      { id: "second-local-id", storageKey: pipeline.id },
      { id: second.id, storageKey: second.name },
    );
    await waitFor(() =>
      expect(result.current.favorites).toEqual([second, first, run]),
    );
  });
});
