import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage } from "@/utils/string";

import { FoldersQueryKeys } from "../types";

export function useMovePipeline() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async ({
      pipelineId,
      folderId,
    }: {
      pipelineId: string;
      folderId: string | null;
    }) => {
      const file = await storage.findPipelineById(pipelineId);

      if (!file.folder.canMoveFilesOut) {
        throw new Error(`Cannot move files out of "${file.folder.name}"`);
      }

      const targetFolder =
        folderId === null
          ? storage.rootFolder
          : await storage.findFolderById(folderId);

      if (!targetFolder.canAcceptFiles) {
        throw new Error(`"${targetFolder.name}" does not accept moved files`);
      }

      await file.moveTo(targetFolder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Pipeline moved", "success");
    },
    onError: (error) => {
      notify("Failed to move pipeline: " + getErrorMessage(error), "error");
    },
  });
}
