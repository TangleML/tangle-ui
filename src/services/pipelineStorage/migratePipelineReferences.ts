import { parseRecent, type RecentItem } from "@/hooks/useRecentlyViewed";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

const RECENT_KEYS = ["Home/recently_viewed", "Home/recently_used"] as const;

function migrateRecentReferences(
  key: (typeof RECENT_KEYS)[number],
  oldKey: string,
  referenceId: string,
  displayName: string,
  documentId?: string,
) {
  const json = localStorage.getItem(key);
  if (!json) return;
  const items = parseRecent(json);
  const identities = new Set([oldKey, referenceId, documentId]);
  const matches = (item: RecentItem) =>
    item.type === "pipeline" && identities.has(item.id);
  if (!items.some(matches)) return;
  const latest = items.reduce<RecentItem | undefined>((current, item) => {
    if (!matches(item)) return current;
    return !current || item.timestamp > current.timestamp ? item : current;
  }, undefined);
  const updated = items.flatMap((item) => {
    if (!matches(item)) return [item];
    return item === latest
      ? [
          {
            ...item,
            id: documentId ?? referenceId,
            name: displayName,
            ...(documentId ? { pipelineReferenceId: referenceId } : {}),
          },
        ]
      : [];
  });
  const newValue = JSON.stringify(updated);
  if (json === newValue) return;
  localStorage.setItem(key, newValue);
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

/** Safe to retry when a store fails after another has already migrated. */
export async function migratePipelineReferences(
  oldKey: string,
  referenceId: string,
  displayName: string,
  documentId?: string,
): Promise<void> {
  if (oldKey === referenceId && !documentId) return;
  const identities = [
    ...new Set(
      [oldKey, referenceId, documentId].filter((id): id is string => !!id),
    ),
  ];
  const id = documentId ?? referenceId;
  await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
    const matches = await LibraryDB.favorites.bulkGet(
      identities.map((value) => ["pipeline", value]),
    );
    const favorite =
      matches.find((item) => item?.id === id) ?? matches.find((item) => item);
    if (!favorite) return;
    await LibraryDB.favorites.put({
      ...favorite,
      id,
      name: displayName,
      ...(documentId ? { pipelineReferenceId: referenceId } : {}),
    });
    for (const value of identities)
      if (value !== id) await LibraryDB.favorites.delete(["pipeline", value]);
  });
  for (const key of RECENT_KEYS)
    migrateRecentReferences(key, oldKey, referenceId, displayName, documentId);
}
