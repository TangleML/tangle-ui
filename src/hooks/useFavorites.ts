import { useLiveQuery } from "dexie-react-hooks";

import {
  type FavoriteItem,
  type FavoriteType,
  LibraryDB,
} from "@/providers/ComponentLibraryProvider/libraries/storage";

export type { FavoriteItem, FavoriteType };

export function useFavorites() {
  const favorites = useLiveQuery(() => LibraryDB.favorites.toArray(), []) ?? [];

  const addFavorite = async (item: FavoriteItem) => {
    // put is an upsert — compound PK [type+id] prevents duplicates
    await LibraryDB.favorites.put(item);
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
