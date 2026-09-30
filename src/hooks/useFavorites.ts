import { useLiveQuery } from "dexie-react-hooks";

import {
  type FavoriteItem,
  type FavoriteType,
  LibraryDB,
} from "@/providers/ComponentLibraryProvider/libraries/storage";

export type { FavoriteItem, FavoriteType };

function matchesFavorite(
  favorite: FavoriteItem,
  type: FavoriteType,
  id: string,
  pipelineReferenceId?: string,
) {
  return (
    favorite.type === type &&
    (favorite.id === id ||
      (type === "pipeline" &&
        pipelineReferenceId !== undefined &&
        favorite.id === pipelineReferenceId &&
        favorite.pipelineReferenceId === undefined) ||
      (type === "pipeline" &&
        pipelineReferenceId === undefined &&
        !id.startsWith("remote:") &&
        !id.startsWith("pending:") &&
        favorite.pipelineReferenceId === id))
  );
}

export function useFavorites() {
  const favorites = useLiveQuery(() => LibraryDB.favorites.toArray(), []) ?? [];

  const addFavorite = async (item: FavoriteItem) => {
    await LibraryDB.favorites.put(item);
  };

  const removeFavorite = async (type: FavoriteType, id: string) => {
    await LibraryDB.favorites.delete([type, id]);
  };

  const isFavorite = (
    type: FavoriteType,
    id: string,
    pipelineReferenceId?: string,
  ) =>
    favorites.some((favorite) =>
      matchesFavorite(favorite, type, id, pipelineReferenceId),
    );

  const toggleFavorite = async (item: FavoriteItem) => {
    const existing = favorites.filter((favorite) =>
      matchesFavorite(favorite, item.type, item.id, item.pipelineReferenceId),
    );
    if (existing.length) {
      await LibraryDB.favorites.bulkDelete(
        existing.map((favorite) => [favorite.type, favorite.id]),
      );
    } else {
      await addFavorite(item);
    }
  };

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite };
}
