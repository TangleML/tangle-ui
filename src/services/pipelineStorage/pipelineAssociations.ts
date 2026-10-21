import { moveRecentPipelineToRemote } from "@/hooks/useRecentlyViewed";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { persistFavoriteOrder, sortFavorites } from "@/services/favoriteOrder";
import { getRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import type { PipelineFile } from "./PipelineFile";

export async function movePipelineAssociationsToRemote(
  local: Pick<PipelineFile, "id" | "storageKey">,
  remote: Pick<PipelineFile, "id" | "storageKey" | "remote">,
): Promise<void> {
  if (!remote.remote)
    throw new Error("The uploaded pipeline has no backend identity.");
  const remoteId = getRemotePipelineSavedId(
    remote.remote.backendUrl,
    remote.id,
  );
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
      type: "pipeline",
      id: remoteId,
      name: remote.storageKey,
      sortKey: position,
    });
    await LibraryDB.favorites.bulkDelete(keys);
    await LibraryDB.favorites.delete(["remote-pipeline", remote.id]);
  });
  moveRecentPipelineToRemote(localIds, {
    id: remote.id,
    name: remote.storageKey,
    backendUrl: remote.remote.backendUrl,
  });
}
