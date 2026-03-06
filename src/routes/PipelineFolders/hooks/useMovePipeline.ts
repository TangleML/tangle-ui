import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { getErrorMessage } from "@/utils/string";

import {
  assignPipelineToFolder,
  movePipelineToRoot,
} from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";

export function useMovePipeline() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({
      pipelineName,
      folderId,
    }: {
      pipelineName: string;
      folderId: string | null;
    }) => {
      if (folderId === null) {
        return movePipelineToRoot(pipelineName);
      }
      return assignPipelineToFolder(pipelineName, folderId);
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
