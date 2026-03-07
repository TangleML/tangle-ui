import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { getErrorMessage, pluralize } from "@/utils/string";

import { moveConnectedFolder } from "../services/connectedFolderStorage";
import { assignPipelineToFolder, moveFolder } from "../services/folderStorage";
import {
  ConnectedFoldersQueryKeys,
  type DragItem,
  FoldersQueryKeys,
} from "../types";

function moveDragItem(item: DragItem, targetFolderId: string) {
  switch (item.type) {
    case "pipeline":
      return assignPipelineToFolder(item.id, targetFolderId);
    case "folder":
      return moveFolder(item.id, targetFolderId);
    case "connected-folder":
      return moveConnectedFolder(item.id, targetFolderId);
  }
}

interface DropMutationOptions {
  onSettled?: () => void;
}

export function useDropMutation({ onSettled }: DropMutationOptions = {}) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async ({
      targetFolderId,
      rawData,
    }: {
      targetFolderId: string;
      rawData: string;
    }) => {
      const items = JSON.parse(rawData) as DragItem[];
      const results = await Promise.all(
        items.map((item) =>
          moveDragItem(item, targetFolderId)
            .then(() => 1)
            .catch(() => 0),
        ),
      );
      return results.reduce<number>((acc, curr) => acc + curr, 0);
    },
    onSuccess: (movedCount) => {
      if (movedCount > 0) {
        queryClient.invalidateQueries({
          queryKey: FoldersQueryKeys.All(),
        });
        queryClient.invalidateQueries({
          queryKey: ConnectedFoldersQueryKeys.All(),
        });
        notify(
          `Moved ${movedCount} ${pluralize(movedCount, "item")}`,
          "success",
        );
      }
      onSettled?.();
    },
    onError: (error) => {
      notify("Failed to move: " + getErrorMessage(error), "error");
    },
  });
}
