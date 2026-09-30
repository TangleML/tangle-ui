import "fake-indexeddb/auto";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
  cleanup();
  await LibraryDB.favorites.clear();
});

describe("useFavorites", () => {
  it("lets the legacy name-only local editor remove a stable favorite", async () => {
    const stable: FavoriteItem = {
      type: "pipeline",
      id: "document-id",
      name: "Daily report",
      pipelineReferenceId: "Daily report",
    };
    await LibraryDB.favorites.put(stable);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() =>
      expect(result.current.isFavorite("pipeline", "Daily report")).toBe(true),
    );

    await act(() =>
      result.current.toggleFavorite({
        type: "pipeline",
        id: "Daily report",
        name: "Daily report",
      }),
    );

    expect(await LibraryDB.favorites.toArray()).toEqual([]);
  });

  it.each([
    "remote:https%3A%2F%2Fbackend.example:pipeline-id",
    "pending:account-a:draft.yaml",
  ])(
    "does not treat the scoped locator %s as a legacy local name",
    async (pipelineReferenceId) => {
      const stable: FavoriteItem = {
        type: "pipeline",
        id: "document-id",
        name: "Daily report",
        pipelineReferenceId,
      };
      await LibraryDB.favorites.put(stable);
      const { result } = renderHook(() => useFavorites());
      await waitFor(() => expect(result.current.favorites).toEqual([stable]));

      expect(result.current.isFavorite("pipeline", pipelineReferenceId)).toBe(
        false,
      );
    },
  );

  it.each([
    "Daily report",
    "remote:https%3A%2F%2Fbackend.example:pipeline-id",
    "pending:account-a:draft.yaml",
  ])(
    "removes stable and legacy favorites together for %s",
    async (referenceId) => {
      const legacy: FavoriteItem = {
        type: "pipeline",
        id: referenceId,
        name: "Daily report",
      };
      const stable: FavoriteItem = {
        ...legacy,
        id: "document-id",
        pipelineReferenceId: referenceId,
      };
      await LibraryDB.favorites.bulkPut([legacy, stable]);
      const { result } = renderHook(() => useFavorites());
      await waitFor(() => expect(result.current.favorites).toHaveLength(2));

      expect(
        result.current.isFavorite("pipeline", stable.id, referenceId),
      ).toBe(true);
      await act(() => result.current.toggleFavorite(stable));

      expect(await LibraryDB.favorites.toArray()).toEqual([]);
    },
  );

  it("preserves favorites belonging to another type or source", async () => {
    const referenceId = "remote:https%3A%2F%2Fbackend.example:pipeline-id";
    const stable: FavoriteItem = {
      type: "pipeline",
      id: "document-id",
      name: "Daily report",
      pipelineReferenceId: referenceId,
    };
    const unrelated: FavoriteItem[] = [
      { type: "run", id: referenceId, name: "Daily report" },
      {
        type: "pipeline",
        id: "remote:https%3A%2F%2Fother.example:pipeline-id",
        name: "Daily report",
      },
      {
        type: "pipeline",
        id: referenceId,
        name: "Daily report",
        pipelineReferenceId: "pending:another-account:draft.yaml",
      },
      { type: "pipeline", id: "another-document-id", name: "Daily report" },
    ];
    await LibraryDB.favorites.bulkPut(unrelated);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() =>
      expect(result.current.favorites).toHaveLength(unrelated.length),
    );

    expect(result.current.isFavorite("pipeline", stable.id, referenceId)).toBe(
      false,
    );
    await act(() => result.current.toggleFavorite(stable));
    await waitFor(() =>
      expect(
        result.current.isFavorite("pipeline", stable.id, referenceId),
      ).toBe(true),
    );
    await act(() => result.current.toggleFavorite(stable));

    expect(await LibraryDB.favorites.toArray()).toEqual(
      expect.arrayContaining(unrelated),
    );
    expect(await LibraryDB.favorites.count()).toBe(unrelated.length);
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
