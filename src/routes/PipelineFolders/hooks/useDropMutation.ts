import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage, pluralize } from "@/utils/string";

import { type DragItem, FoldersQueryKeys } from "../types";

async function moveDragItem(
  item: DragItem,
  targetFolderId: string,
  storage: ReturnType<typeof usePipelineStorage>,
) {
  const targetFolder = await storage.findFolderById(targetFolderId);

  switch (item.type) {
    case "pipeline": {
      const file = await storage.findPipelineById(item.id);
      if (!file) throw new Error(`Pipeline "${item.id}" not found`);

      if (!file.folder.canMoveFilesOut) {
        throw new Error(`Cannot move files out of "${file.folder.name}"`);
      }
      if (!targetFolder.canAcceptFiles) {
        throw new Error(`"${targetFolder.name}" does not accept moved files`);
      }

      await file.moveTo(targetFolder);
      break;
    }
    case "folder": {
      const folder = await storage.findFolderById(item.id);
      await folder.moveToParent(targetFolderId);
      break;
    }
  }
}

interface DropMutationOptions {
  onSettled?: () => void;
}

export function useDropMutation({ onSettled }: DropMutationOptions = {}) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

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
        items.map(
          (item) => moveDragItem(item, targetFolderId, storage).then(() => 1),
          // .catch(() => 0),
        ),
      );
      return results.reduce<number>((acc, curr) => acc + curr, 0);
    },
    onSuccess: (movedCount) => {
      if (movedCount > 0) {
        queryClient.invalidateQueries({
          queryKey: FoldersQueryKeys.All(),
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
