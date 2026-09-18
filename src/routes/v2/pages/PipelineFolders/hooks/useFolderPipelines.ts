import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import { subscribeUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

export function useFolderPipelines(folderId: string | null) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeUserPipelineWritten(() => {
        void queryClient.invalidateQueries({
          queryKey: FoldersQueryKeys.Pipelines(folderId),
        });
      }),
    [folderId, queryClient],
  );

  return useSuspenseQuery({
    queryKey: [...FoldersQueryKeys.Pipelines(folderId), storage.scope],
    queryFn: async (): Promise<PipelineFile[]> => {
      const folder =
        folderId === null
          ? storage.rootFolder
          : await storage.findFolderById(folderId);

      if (folder.requiresPermission) {
        const status = await folder.driver.permissions?.check();
        if (status !== "granted") return [];
      }

      return storage.listPipelines(folderId ?? undefined);
    },
  });
}
