import { useEffect, useState } from "react";

import { useBackend } from "@/providers/BackendProvider";
import {
  getRemotePipelineSavedId,
  isSavedPipelineForBackend,
  normalizeRemotePipelineSavedId,
} from "@/services/remotePipelineSavedLinks";
import { getStorage } from "@/utils/typedStorage";

const RECENTLY_VIEWED_KEY = "Home/recently_viewed";
const RECENTLY_USED_KEY = "Home/recently_used";
const MAX_ITEMS = 100;

type RecentKey = typeof RECENTLY_VIEWED_KEY | typeof RECENTLY_USED_KEY;

const RECENT_ITEM_TYPES = [
  "pipeline",
  "remote-pipeline",
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
  return json
    ? parseRecent(json).map((item) =>
        item.type === "pipeline"
          ? { ...item, id: normalizeRemotePipelineSavedId(item.id) }
          : item,
      )
    : [];
}

// `storage` events only reach the other tabs, so a write here tells this one.
const listeners = new Set<(key: RecentKey) => void>();

function writeRecent(key: RecentKey, items: RecentItem[], required = false) {
  if (required) localStorage.setItem(key, JSON.stringify(items));
  else storage.setItem(key, items);
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
  const { backendUrl } = useBackend();
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

  return items.filter((item) => isSavedPipelineForBackend(item, backendUrl));
}

export function useRecentlyViewed() {
  return { recentlyViewed: useRecent(RECENTLY_VIEWED_KEY) };
}

type RecentInput = Omit<RecentItem, "timestamp">;
type LocalRecentType = Exclude<RecentItemType, "remote-pipeline">;

export function addRecentlyViewed(
  item: RecentInput & { type: "remote-pipeline" },
  backendUrl: string,
): void;
export function addRecentlyViewed(
  item: RecentInput & { type: LocalRecentType },
): void;
export function addRecentlyViewed(item: RecentInput, backendUrl?: string) {
  if (item.type === "remote-pipeline" && !backendUrl?.trim())
    throw new Error("A backend is required for remote pipeline history.");
  addRecent(
    RECENTLY_VIEWED_KEY,
    item.type === "remote-pipeline" && backendUrl
      ? {
          ...item,
          type: "pipeline",
          id: getRemotePipelineSavedId(backendUrl, item.id),
        }
      : item,
  );
}

/**
 * A recent entry is a link, and a link to a deleted thing is worse than no
 * link: it is offered, clicked, and lands nowhere.
 */
export function removeRecentlyViewed(
  type: "remote-pipeline",
  id: string,
  backendUrl: string,
): void;
export function removeRecentlyViewed(type: LocalRecentType, id: string): void;
export function removeRecentlyViewed(
  type: RecentItemType,
  id: string,
  backendUrl?: string,
) {
  if (type === "remote-pipeline" && !backendUrl?.trim())
    throw new Error("A backend is required for remote pipeline history.");
  removeRecent(RECENTLY_VIEWED_KEY, type, id);
  removeRecent(RECENTLY_USED_KEY, type, id);
  if (type === "remote-pipeline" && backendUrl) {
    const storedId = getRemotePipelineSavedId(backendUrl, id);
    removeRecent(RECENTLY_VIEWED_KEY, "pipeline", storedId);
    removeRecent(RECENTLY_USED_KEY, "pipeline", storedId);
  }
}

export function moveRecentPipelineToRemote(
  localIds: readonly string[],
  remote: { id: string; name: string; backendUrl: string },
) {
  const remoteId = getRemotePipelineSavedId(remote.backendUrl, remote.id);
  for (const key of [RECENTLY_VIEWED_KEY, RECENTLY_USED_KEY] as const) {
    const items = readRecent(key);
    const isLocal = (item: RecentItem) =>
      item.type === "pipeline" && localIds.includes(item.id);
    if (!items.some(isLocal)) continue;

    const matches = items.filter(
      (item) =>
        isLocal(item) ||
        (item.type === "pipeline" && item.id === remoteId) ||
        (item.type === "remote-pipeline" && item.id === remote.id),
    );
    const latest = matches.reduce((a, b) =>
      a.timestamp >= b.timestamp ? a : b,
    );
    writeRecent(
      key,
      items.flatMap((item) => {
        if (!matches.includes(item)) return [item];
        return item === latest
          ? [
              {
                type: "pipeline",
                id: remoteId,
                name: remote.name,
                timestamp: item.timestamp,
              },
            ]
          : [];
      }),
      // A failed migration must keep the local pipeline available.
      true,
    );
  }
}

export function useRecentlyUsed() {
  return { recentlyUsed: useRecent(RECENTLY_USED_KEY) };
}

export function addRecentlyUsed(item: Omit<RecentItem, "timestamp">) {
  addRecent(RECENTLY_USED_KEY, item);
}
