import { parseRecent, type RecentItem } from "@/hooks/useRecentlyViewed";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

const RECENT_KEYS = ["Home/recently_viewed", "Home/recently_used"] as const;

function migrateRecentReferences(
  key: (typeof RECENT_KEYS)[number],
  oldKey: string,
  newKey: string,
  displayName: string,
) {
  const json = localStorage.getItem(key);
  if (!json) return;

  const items = parseRecent(json);
  if (!items.some((item) => item.type === "pipeline" && item.id === oldKey)) {
    return;
  }

  const matchesPipeline = (item: RecentItem) =>
    item.type === "pipeline" && (item.id === oldKey || item.id === newKey);
  const latest = items.reduce<RecentItem | undefined>((current, item) => {
    if (!matchesPipeline(item)) return current;
    return !current || item.timestamp > current.timestamp ? item : current;
  }, undefined);
  const updated = items.flatMap((item) => {
    if (!matchesPipeline(item)) return [item];
    return item === latest ? [{ ...item, id: newKey, name: displayName }] : [];
  });

  const newValue = JSON.stringify(updated);
  localStorage.setItem(key, newValue);
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

/** Safe to retry when a store fails after another has already migrated. */
export async function migratePipelineReferences(
  oldKey: string,
  newKey: string,
  displayName: string,
): Promise<void> {
  if (oldKey === newKey) return;

  await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
    const favorite = await LibraryDB.favorites.get(["pipeline", oldKey]);
    if (!favorite) return;

    await LibraryDB.favorites.put({
      ...favorite,
      id: newKey,
      name: displayName,
    });
    await LibraryDB.favorites.delete(["pipeline", oldKey]);
  });

  for (const key of RECENT_KEYS) {
    migrateRecentReferences(key, oldKey, newKey, displayName);
  }
}
