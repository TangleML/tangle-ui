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
} from "@/services/remotePipelineSavedLinks";

export type { FavoriteItem, FavoriteType };

export function useFavorites() {
  const { backendUrl } = useBackend();
  const allFavorites =
    useLiveQuery(
      async () =>
        sortFavorites(await LibraryDB.favorites.toArray()).map(
          ({ type, id, name }) => ({
            type,
            id: type === "pipeline" ? normalizeRemotePipelineSavedId(id) : id,
            name,
          }),
        ),
      [],
    ) ?? [];
  const favorites = allFavorites.filter(
    (item, index) =>
      isSavedPipelineForBackend(item, backendUrl) &&
      allFavorites.findIndex(
        (other) => other.type === item.type && other.id === item.id,
      ) === index,
  );

  const storedKey = (
    type: FavoriteType,
    id: string,
    targetBackendUrl = backendUrl,
  ): [FavoriteType, string] =>
    type === "remote-pipeline"
      ? ["pipeline", getRemotePipelineSavedId(targetBackendUrl, id)]
      : [type, id];

  const addFavorite = async (item: FavoriteItem) => {
    const [type, id] = storedKey(item.type, item.id);
    await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
      const ordered = await persistFavoriteOrder(
        sortFavorites(await LibraryDB.favorites.toArray()),
      );
      const existing = ordered.find(
        (favorite) =>
          (favorite.type === type &&
            (type === "pipeline"
              ? normalizeRemotePipelineSavedId(favorite.id)
              : favorite.id) === id) ||
          (favorite.type === item.type && favorite.id === item.id),
      );
      await LibraryDB.favorites.bulkDelete(
        ordered
          .filter(
            (favorite) =>
              (favorite.type === type &&
                (type === "pipeline"
                  ? normalizeRemotePipelineSavedId(favorite.id)
                  : favorite.id) === id) ||
              (favorite.type === item.type && favorite.id === item.id),
          )
          .map((favorite): [FavoriteType, string] => [
            favorite.type,
            favorite.id,
          ]),
      );
      await LibraryDB.favorites.put({
        ...item,
        type,
        id,
        sortKey: existing?.sortKey ?? -1,
      });
    });
  };

  const removeFavorite = async (type: FavoriteType, id: string, targetBackendUrl = backendUrl) => {
    const [storedType, storedId] = storedKey(type, id, targetBackendUrl);
    await LibraryDB.favorites
      .filter(
        (favorite) =>
          (favorite.type === storedType &&
            (storedType === "pipeline"
              ? normalizeRemotePipelineSavedId(favorite.id)
              : favorite.id) === storedId) ||
          (favorite.type === type && favorite.id === id),
      )
      .delete();
  };

  const isFavorite = (type: FavoriteType, id: string) => {
    const [storedType, storedId] = storedKey(type, id);
    return favorites.some(
      (f) =>
        (f.type === storedType && f.id === storedId) ||
        (f.type === type && f.id === id),
    );
  };

  const toggleFavorite = async (item: FavoriteItem) => {
    if (isFavorite(item.type, item.id)) {
      await removeFavorite(item.type, item.id);
    } else {
      await addFavorite(item);
    }
  };

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite };
}
