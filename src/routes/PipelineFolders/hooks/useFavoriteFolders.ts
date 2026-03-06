import { useSuspenseQuery } from "@tanstack/react-query";

import { getFavoriteFolders } from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";

export function useFavoriteFolders() {
  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Favorites(),
    queryFn: getFavoriteFolders,
  });
}
