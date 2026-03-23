import { useCallback, useSyncExternalStore } from "react";

import { getStorage } from "@/utils/typedStorage";

const FAVORITES_STORAGE_KEY = "Home/favorites";

export type FavoriteType = "pipeline" | "run";

export interface FavoriteItem {
  type: FavoriteType;
  id: string;
  name: string;
}

type FavoritesStorageMapping = {
  [FAVORITES_STORAGE_KEY]: FavoriteItem[];
};

const storage = getStorage<
  typeof FAVORITES_STORAGE_KEY,
  FavoritesStorageMapping
>();

// useSyncExternalStore requires getSnapshot to return a stable reference.
// We cache the last parsed value and only update it when the raw JSON changes.
let cachedJson: string | null = null;
let cachedFavorites: FavoriteItem[] = [];

function readFavorites(): FavoriteItem[] {
  const json = localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (json === cachedJson) return cachedFavorites;
  cachedJson = json;
  cachedFavorites = json ? (JSON.parse(json) as FavoriteItem[]) : [];
  return cachedFavorites;
}

function subscribe(callback: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === FAVORITES_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function useFavorites() {
  // useSyncExternalStore keeps the hook reactive to localStorage changes,
  // including changes dispatched by typedStorage from the same window.
  const favorites = useSyncExternalStore(subscribe, readFavorites, () => []);

  const addFavorite = useCallback((item: FavoriteItem) => {
    const current = readFavorites();
    const alreadyExists = current.some(
      (f) => f.type === item.type && f.id === item.id,
    );
    if (!alreadyExists) {
      storage.setItem(FAVORITES_STORAGE_KEY, [...current, item]);
    }
  }, []);

  const removeFavorite = useCallback((type: FavoriteType, id: string) => {
    const current = readFavorites();
    storage.setItem(
      FAVORITES_STORAGE_KEY,
      current.filter((f) => !(f.type === type && f.id === id)),
    );
  }, []);

  const toggleFavorite = useCallback((item: FavoriteItem) => {
    const current = readFavorites();
    const exists = current.some(
      (f) => f.type === item.type && f.id === item.id,
    );
    if (exists) {
      storage.setItem(
        FAVORITES_STORAGE_KEY,
        current.filter((f) => !(f.type === item.type && f.id === item.id)),
      );
    } else {
      storage.setItem(FAVORITES_STORAGE_KEY, [...current, item]);
    }
  }, []);

  const isFavorite = useCallback(
    (type: FavoriteType, id: string) =>
      favorites.some((f) => f.type === type && f.id === id),
    [favorites],
  );

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite };
}
