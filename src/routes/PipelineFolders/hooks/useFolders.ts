import { useSuspenseQuery } from "@tanstack/react-query";

import { getChildFolders } from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";

export function useFolders(parentId: string | null) {
  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Children(parentId),
    queryFn: () => getChildFolders(parentId),
  });
}
