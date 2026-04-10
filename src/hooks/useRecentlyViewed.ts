import { useSyncExternalStore } from "react";

import { getStorage } from "@/utils/typedStorage";

const RECENTLY_VIEWED_KEY = "Home/recently_viewed";
const MAX_ITEMS = 5;

export type RecentlyViewedType = "pipeline" | "run" | "component";

export interface RecentlyViewedItem {
  type: RecentlyViewedType;
  id: string;
  name: string;
  viewedAt: number;
}

type RecentlyViewedStorageMapping = {
  [RECENTLY_VIEWED_KEY]: RecentlyViewedItem[];
};

const storage = getStorage<
  typeof RECENTLY_VIEWED_KEY,
  RecentlyViewedStorageMapping
>();

// useSyncExternalStore requires getSnapshot to return a stable reference.
let cachedJson: string | null = null;
let cachedItems: RecentlyViewedItem[] = [];

function isRecentlyViewedItem(item: unknown): item is RecentlyViewedItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    "id" in item &&
    "name" in item &&
    "viewedAt" in item
  );
}

function parseRecentlyViewed(json: string): RecentlyViewedItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(isRecentlyViewedItem) : [];
  } catch {
    return [];
  }
}

function readRecentlyViewed(): RecentlyViewedItem[] {
  const json = localStorage.getItem(RECENTLY_VIEWED_KEY);
  if (json === cachedJson) return cachedItems;
  cachedJson = json;
  cachedItems = json ? parseRecentlyViewed(json) : [];
  return cachedItems;
}

function subscribe(callback: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === RECENTLY_VIEWED_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function addRecentlyViewed(item: Omit<RecentlyViewedItem, "viewedAt">) {
  const current = readRecentlyViewed();
  // Remove any existing entry for the same item, then prepend the fresh one
  const deduped = current.filter(
    (existing) => !(existing.type === item.type && existing.id === item.id),
  );
  const updated = [{ ...item, viewedAt: Date.now() }, ...deduped].slice(
    0,
    MAX_ITEMS,
  );
  storage.setItem(RECENTLY_VIEWED_KEY, updated);
}

export function useRecentlyViewed() {
  const recentlyViewed = useSyncExternalStore(
    subscribe,
    readRecentlyViewed,
    () => [],
  );

  return { recentlyViewed, addRecentlyViewed };
}
