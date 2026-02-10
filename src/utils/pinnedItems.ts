import { isRecord } from "@/utils/typeGuards";

const STORAGE_KEY = "dashboard/pinned-items";
const MAX_PINNED = 20;

type PinnedItemType = "pipeline" | "run";

interface PinnedItem {
  title: string;
  type: PinnedItemType;
  url: string;
}

function isPinnedItem(value: unknown): value is PinnedItem {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    (value.type === "pipeline" || value.type === "run") &&
    typeof value.url === "string"
  );
}

function getAll(): PinnedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPinnedItem);
  } catch {
    return [];
  }
}

function save(items: PinnedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function getPinnedItems(type?: PinnedItemType): PinnedItem[] {
  const items = getAll();
  if (!type) return items;
  return items.filter((item) => item.type === type);
}

export function setPinnedItem(item: PinnedItem, isPinned: boolean): void {
  const current = getAll();
  const filtered = current.filter(
    (currentItem) => currentItem.url !== item.url,
  );
  if (!isPinned) {
    save(filtered);
    return;
  }

  const updated = [item, ...filtered].slice(0, MAX_PINNED);
  save(updated);
}
