import {
  LibraryDB,
  type StoredFavoriteItem,
} from "@/providers/ComponentLibraryProvider/libraries/storage";

export function sortFavorites(
  items: readonly StoredFavoriteItem[],
): StoredFavoriteItem[] {
  return items
    .map((item, index) => ({ item, position: item.sortKey ?? index }))
    .sort((a, b) => a.position - b.position)
    .map(({ item }) => item);
}

// Call inside the same transaction as adding or replacing a favorite. Capture
// the visible order before a changed primary key can change IndexedDB's order.
export async function persistFavoriteOrder(
  ordered: readonly StoredFavoriteItem[],
): Promise<StoredFavoriteItem[]> {
  const positioned = ordered.map((item, sortKey) => ({ ...item, sortKey }));
  const changed = positioned.filter(
    (item, index) => item.sortKey !== ordered[index].sortKey,
  );
  if (changed.length) await LibraryDB.favorites.bulkPut(changed);
  return positioned;
}
