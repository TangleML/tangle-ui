import { useSuspenseQuery } from "@tanstack/react-query";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import { FoldersQueryKeys } from "../types";

export function useFolderPipelines(folderId: string | null) {
  const storage = usePipelineStorage();

  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Pipelines(folderId),
    queryFn: async (): Promise<PipelineFile[]> => {
      const folder =
        folderId === null
          ? storage.rootFolder
          : await storage.findFolderById(folderId);

      if (folder.requiresPermission) {
        const status = await folder.driver.permissions?.check();
        if (status !== "granted") return [];
      }

      return folder.listPipelines();
    },
  });
}
