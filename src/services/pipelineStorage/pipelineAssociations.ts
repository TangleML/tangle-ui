import { moveRecentPipelineToRemote } from "@/hooks/useRecentlyViewed";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { persistFavoriteOrder, sortFavorites } from "@/services/favoriteOrder";

import type { PipelineFile } from "./PipelineFile";

export async function movePipelineAssociationsToRemote(
  local: Pick<PipelineFile, "id" | "storageKey">,
  remote: Pick<PipelineFile, "id" | "storageKey">,
): Promise<void> {
  const localIds = [...new Set([local.storageKey, local.id])];
  await LibraryDB.transaction("rw", LibraryDB.favorites, async () => {
    const keys = localIds.map((id) => ["pipeline", id] as ["pipeline", string]);
    const favorites = sortFavorites(await LibraryDB.favorites.toArray());
    const position = favorites.findIndex(
      (item) => item.type === "pipeline" && localIds.includes(item.id),
    );
    if (position < 0) return;

    await persistFavoriteOrder(favorites);

    await LibraryDB.favorites.put({
      type: "remote-pipeline",
      id: remote.id,
      name: remote.storageKey,
      sortKey: position,
    });
    await LibraryDB.favorites.bulkDelete(keys);
  });
  moveRecentPipelineToRemote(localIds, {
    id: remote.id,
    name: remote.storageKey,
  });
}
