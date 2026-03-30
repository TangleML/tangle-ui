import { useSuspenseQuery } from "@tanstack/react-query";

import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";

export function useFolders(parentId: string | null) {
  const storage = usePipelineStorage();

  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Children(parentId),
    queryFn: async () => {
      const folder =
        parentId === null
          ? storage.rootFolder
          : await storage.findFolderById(parentId);

      return folder.listSubfolders();
    },
  });
}
