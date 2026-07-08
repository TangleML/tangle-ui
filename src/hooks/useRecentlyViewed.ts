import { useEffect, useState } from "react";

import { getStorage } from "@/utils/typedStorage";

const RECENTLY_VIEWED_KEY = "Home/recently_viewed";
const RECENTLY_USED_KEY = "Home/recently_used";
const MAX_ITEMS = 100;

type RecentKey = typeof RECENTLY_VIEWED_KEY | typeof RECENTLY_USED_KEY;

const RECENT_ITEM_TYPES = ["pipeline", "run", "component", "tour"] as const;

type RecentItemType = (typeof RECENT_ITEM_TYPES)[number];

export interface RecentItem {
  type: RecentItemType;
  id: string;
  name: string;
  timestamp: number;
}

type RecentStorageMapping = {
  [RECENTLY_VIEWED_KEY]: RecentItem[];
  [RECENTLY_USED_KEY]: RecentItem[];
};

const storage = getStorage<RecentKey, RecentStorageMapping>();

function isRecentItem(item: unknown): item is RecentItem {
  if (typeof item !== "object" || item === null) return false;
  const candidate = item as Record<string, unknown>;
  return (
    RECENT_ITEM_TYPES.includes(candidate.type as RecentItemType) &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.timestamp === "number" &&
    Number.isFinite(candidate.timestamp)
  );
}

export function parseRecent(json: string): RecentItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(isRecentItem) : [];
  } catch {
    return [];
  }
}

function readRecent(key: RecentKey): RecentItem[] {
  const json = localStorage.getItem(key);
  return json ? parseRecent(json) : [];
}

function addRecent(key: RecentKey, item: Omit<RecentItem, "timestamp">) {
  const current = readRecent(key);
  const deduped = current.filter(
    (existing) => !(existing.type === item.type && existing.id === item.id),
  );
  const updated = [{ ...item, timestamp: Date.now() }, ...deduped].slice(
    0,
    MAX_ITEMS,
  );
  storage.setItem(key, updated);
}

function useRecent(key: RecentKey): RecentItem[] {
  const [items, setItems] = useState<RecentItem[]>(() => readRecent(key));

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) {
        setItems(readRecent(key));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  return items;
}

export function useRecentlyViewed() {
  return { recentlyViewed: useRecent(RECENTLY_VIEWED_KEY) };
}

export function addRecentlyViewed(item: Omit<RecentItem, "timestamp">) {
  addRecent(RECENTLY_VIEWED_KEY, item);
}

export function useRecentlyUsed() {
  return { recentlyUsed: useRecent(RECENTLY_USED_KEY) };
}

export function addRecentlyUsed(item: Omit<RecentItem, "timestamp">) {
  addRecent(RECENTLY_USED_KEY, item);
}
