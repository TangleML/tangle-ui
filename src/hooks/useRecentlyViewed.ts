import { useEffect, useState } from "react";

import { getStorage } from "@/utils/typedStorage";

const RECENTLY_VIEWED_KEY = "Home/recently_viewed";
const RECENTLY_USED_KEY = "Home/recently_used";
const MAX_ITEMS = 100;

type RecentKey = typeof RECENTLY_VIEWED_KEY | typeof RECENTLY_USED_KEY;

const RECENT_ITEM_TYPES = [
  "pipeline",
  "run",
  "component",
  "tour",
  "project",
] as const;

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

// `storage` events only reach the other tabs, so a write here tells this one.
const listeners = new Set<(key: RecentKey) => void>();

function writeRecent(key: RecentKey, items: RecentItem[]) {
  storage.setItem(key, items);
  listeners.forEach((listener) => listener(key));
}

function withoutItem(
  items: RecentItem[],
  type: RecentItemType,
  id: string,
): RecentItem[] {
  return items.filter((item) => !(item.type === type && item.id === id));
}

function addRecent(key: RecentKey, item: Omit<RecentItem, "timestamp">) {
  const deduped = withoutItem(readRecent(key), item.type, item.id);
  writeRecent(
    key,
    [{ ...item, timestamp: Date.now() }, ...deduped].slice(0, MAX_ITEMS),
  );
}

function removeRecent(key: RecentKey, type: RecentItemType, id: string) {
  const current = readRecent(key);
  const remaining = withoutItem(current, type, id);
  if (remaining.length === current.length) return;
  writeRecent(key, remaining);
}

function useRecent(key: RecentKey): RecentItem[] {
  const [items, setItems] = useState<RecentItem[]>(() => readRecent(key));

  useEffect(() => {
    const reread = () => setItems(readRecent(key));
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) reread();
    };
    const handleLocal = (written: RecentKey) => {
      if (written === key) reread();
    };

    listeners.add(handleLocal);
    window.addEventListener("storage", handleStorage);
    return () => {
      listeners.delete(handleLocal);
      window.removeEventListener("storage", handleStorage);
    };
  }, [key]);

  return items;
}

export function useRecentlyViewed() {
  return { recentlyViewed: useRecent(RECENTLY_VIEWED_KEY) };
}

export function addRecentlyViewed(item: Omit<RecentItem, "timestamp">) {
  addRecent(RECENTLY_VIEWED_KEY, item);
}

/**
 * Forgets something that no longer exists. A recent entry is a link, and a link
 * to a deleted thing is worse than no link: it is offered, clicked, and lands
 * nowhere.
 */
export function removeRecentlyViewed(type: RecentItemType, id: string) {
  removeRecent(RECENTLY_VIEWED_KEY, type, id);
  removeRecent(RECENTLY_USED_KEY, type, id);
}

export function useRecentlyUsed() {
  return { recentlyUsed: useRecent(RECENTLY_USED_KEY) };
}

export function addRecentlyUsed(item: Omit<RecentItem, "timestamp">) {
  addRecent(RECENTLY_USED_KEY, item);
}
