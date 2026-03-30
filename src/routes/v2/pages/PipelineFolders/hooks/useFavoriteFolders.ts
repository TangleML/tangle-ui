import { useSuspenseQuery } from "@tanstack/react-query";

import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";

export function useFavoriteFolders() {
  const storage = usePipelineStorage();

  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Favorites(),
    queryFn: () => storage.getFavoriteFolders(),
  });
}
