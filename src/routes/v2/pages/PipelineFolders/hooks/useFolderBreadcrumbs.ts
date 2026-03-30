import { useSuspenseQuery } from "@tanstack/react-query";

import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";

export function useFolderBreadcrumbs(folderId: string | null) {
  const storage = usePipelineStorage();

  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Breadcrumbs(folderId),
    queryFn: async (): Promise<PipelineFolder[]> => {
      if (folderId === null) return [];

      const folder = await storage.findFolderById(folderId);
      return folder.breadcrumbPath();
    },
  });
}
