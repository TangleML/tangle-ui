import { useLiveQuery } from "dexie-react-hooks";

import { useBackend } from "@/providers/BackendProvider";
import {
  type FavoriteItem,
  type FavoriteType,
  LibraryDB,
} from "@/providers/ComponentLibraryProvider/libraries/storage";
import { persistFavoriteOrder, sortFavorites } from "@/services/favoriteOrder";
import {
  getRemotePipelineSavedId,
  isSavedPipelineForBackend,
  normalizeRemotePipelineSavedId,
  parseRemotePipelineSavedId,
} from "@/services/remotePipelineSavedLinks";

export type { FavoriteItem, FavoriteType };

export function useFavorites() {
  const { backendUrl } = useBackend();
  const allFavorites =
    useLiveQuery(
      async () =>
        sortFavorites(await LibraryDB.favorites.toArray())
          .filter(
            ({ type }) =>
              type === "pipeline" || type === "run" || type === "project",
          )
          .map(({ type, id, name }) => ({
            type,
            id: type === "pipeline" ? normalizeRemotePipelineSavedId(id) : id,
            name,
          })),
      [],
    ) ?? [];
  const favorites = allFavorites.filter((item) =>
    isSavedPipelineForBackend(item, backendUrl),
  );

  const storedId = (
    type: FavoriteType,
    id: string,
    targetBackendUrl = backendUrl,
  ) =>
    type === "pipeline"
      ? parseRemotePipelineSavedId(id)
        ? normalizeRemotePipelineSavedId(id)
        : getRemotePipelineSavedId(targetBackendUrl, id)
      : id;

  const addFavorite = async (item: FavoriteItem) => {
    const id = storedId(item.type, item.id);
    await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
      const ordered = await persistFavoriteOrder(
        sortFavorites(await LibraryDB.favorites.toArray()),
      );
      const existing = ordered.filter(
        (favorite) =>
          favorite.type === item.type &&
          (favorite.type === "pipeline"
            ? normalizeRemotePipelineSavedId(favorite.id)
            : favorite.id) === id,
      );
      await LibraryDB.favorites.bulkDelete(
        existing.map((favorite): [FavoriteType, string] => [
          favorite.type,
          favorite.id,
        ]),
      );
      await LibraryDB.favorites.put({
        ...item,
        id,
        sortKey: existing[0]?.sortKey ?? -1,
      });
    });
  };

  const removeFavorite = async (
    type: FavoriteType,
    id: string,
    targetBackendUrl = backendUrl,
  ) => {
    const key = storedId(type, id, targetBackendUrl);
    await LibraryDB.favorites
      .filter(
        (favorite) =>
          favorite.type === type &&
          (favorite.type === "pipeline"
            ? normalizeRemotePipelineSavedId(favorite.id)
            : favorite.id) === key,
      )
      .delete();
  };

  const isFavorite = (type: FavoriteType, id: string) =>
    favorites.some(
      (favorite) =>
        favorite.type === type && favorite.id === storedId(type, id),
    );

  const toggleFavorite = async (item: FavoriteItem) => {
    if (isFavorite(item.type, item.id))
      await removeFavorite(item.type, item.id);
    else await addFavorite(item);
  };

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite };
}
