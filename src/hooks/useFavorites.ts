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
            id,
            name,
          }),
        ),
      [],
    ) ?? [];
  const favorites = allFavorites.filter((item) =>
    isSavedPipelineForBackend(item, backendUrl),
  );

  const storedKey = (type: FavoriteType, id: string): [FavoriteType, string] =>
    type === "remote-pipeline"
      ? ["pipeline", getRemotePipelineSavedId(backendUrl, id)]
      : [type, id];

  const addFavorite = async (item: FavoriteItem) => {
    const [type, id] = storedKey(item.type, item.id);
    await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
      const ordered = await persistFavoriteOrder(
        sortFavorites(await LibraryDB.favorites.toArray()),
      );
      const existing = ordered.find(
        (favorite) =>
          (favorite.type === type && favorite.id === id) ||
          (favorite.type === item.type && favorite.id === item.id),
      );
      if (item.type === "remote-pipeline") {
        await LibraryDB.favorites.delete([item.type, item.id]);
      }
      await LibraryDB.favorites.put({
        ...item,
        type,
        id,
        sortKey: existing?.sortKey ?? -1,
      });
    });
  };

  const removeFavorite = async (type: FavoriteType, id: string) => {
    await LibraryDB.favorites.bulkDelete([storedKey(type, id), [type, id]]);
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
