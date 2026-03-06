import { useSuspenseQuery } from "@tanstack/react-query";

import { getFolderPath } from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";

export function useFolderBreadcrumbs(folderId: string | null) {
  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Breadcrumbs(folderId),
    queryFn: () => getFolderPath(folderId),
  });
}
