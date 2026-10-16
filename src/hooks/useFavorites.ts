import { useLiveQuery } from "dexie-react-hooks";

import {
  type FavoriteItem,
  type FavoriteType,
  LibraryDB,
} from "@/providers/ComponentLibraryProvider/libraries/storage";
import { persistFavoriteOrder, sortFavorites } from "@/services/favoriteOrder";

export type { FavoriteItem, FavoriteType };

export function useFavorites() {
  const favorites =
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

  const addFavorite = async (item: FavoriteItem) => {
    await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
      const ordered = await persistFavoriteOrder(
        sortFavorites(await LibraryDB.favorites.toArray()),
      );
      const existing = ordered.find(
        (favorite) => favorite.type === item.type && favorite.id === item.id,
      );
      await LibraryDB.favorites.put({
        ...item,
        sortKey: existing?.sortKey ?? -1,
      });
    });
  };

  const removeFavorite = async (type: FavoriteType, id: string) => {
    await LibraryDB.favorites.delete([type, id]);
  };

  const isFavorite = (type: FavoriteType, id: string) =>
    favorites.some((f) => f.type === type && f.id === id);

  const toggleFavorite = async (item: FavoriteItem) => {
    if (isFavorite(item.type, item.id)) {
      await removeFavorite(item.type, item.id);
    } else {
      await addFavorite(item);
    }
  };

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite };
}
