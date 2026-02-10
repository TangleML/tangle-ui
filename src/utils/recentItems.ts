import { isRecord } from "@/utils/typeGuards";

const STORAGE_KEY = "dashboard/recent-items";
const MAX_RECENT = 20;

type RecentItemType = "pipeline" | "run";

interface RecentItem {
  title: string;
  type: RecentItemType;
  url: string;
}

function isRecentItem(value: unknown): value is RecentItem {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    (value.type === "pipeline" || value.type === "run") &&
    typeof value.url === "string"
  );
}

function getAll(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentItem);
  } catch {
    return [];
  }
}

function save(items: RecentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Returns all recent items sorted by most recently opened first.
 * Optionally filter by type.
 */
export function getRecentItems(type?: RecentItemType): RecentItem[] {
  const items = getAll();
  if (!type) return items;
  return items.filter((item) => item.type === type);
}

/** Stores a recent item, deduped by URL, newest first. */
export function recordRecentItem(item: RecentItem): void {
  const current = getAll();
  const filtered = current.filter(
    (currentItem) => currentItem.url !== item.url,
  );
  const updated = [item, ...filtered].slice(0, MAX_RECENT);
  save(updated);
}
