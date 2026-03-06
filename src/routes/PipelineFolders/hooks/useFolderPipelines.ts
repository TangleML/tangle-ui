import { useSuspenseQuery } from "@tanstack/react-query";

import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { getPipelineNamesInFolder } from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";

type PipelineEntry = [string, ComponentFileEntry];

/**
 * Returns pipelines belonging to the given folder.
 * For root (null), returns pipelines NOT assigned to any folder.
 */
export function useFolderPipelines(folderId: string | null) {
  return useSuspenseQuery({
    queryKey: FoldersQueryKeys.Pipelines(folderId),
    queryFn: async (): Promise<PipelineEntry[]> => {
      const [allPipelines, assignedNames] = await Promise.all([
        getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME),
        getPipelineNamesInFolder(folderId),
      ]);

      const entries = [...allPipelines.entries()].sort(
        (a, b) =>
          new Date(b[1].modificationTime).getTime() -
          new Date(a[1].modificationTime).getTime(),
      );

      if (folderId === null) {
        return entries.filter(([name]) => !assignedNames.has(name));
      }

      return entries.filter(([name]) => assignedNames.has(name));
    },
  });
}
