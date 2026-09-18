import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import {
  getAllComponentFilesFromList,
  loadComponentAsRefFromText,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { getErrorMessage } from "@/utils/string";
import { subscribeUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import type { PipelineFilterEntry } from "./usePipelineFilters";

export interface PipelineListEntry extends PipelineFilterEntry {
  file?: PipelineFile;
}

export function usePipelineList() {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeUserPipelineWritten(() => {
        void queryClient.invalidateQueries({
          queryKey: [...FoldersQueryKeys.All(), "flat-list", storage.scope],
        });
      }),
    [queryClient, storage.scope],
  );

  return useQuery({
    queryKey: [...FoldersQueryKeys.All(), "flat-list", storage.scope],
    queryFn: async () => {
      const localEntries = await getAllComponentFilesFromList(
        USER_PIPELINES_LIST_NAME,
      );
      const localFiles = await Promise.all(
        Array.from(localEntries.keys()).map((name) =>
          storage.rootFolder.assignFile(name),
        ),
      );
      const visibleFiles =
        await storage.filterVisibleLocalPipelines(localFiles);
      const pipelines = new Map<string, PipelineListEntry>();
      for (const file of visibleFiles) {
        const entry = localEntries.get(file.storageKey);
        if (entry) {
          pipelines.set(file.referenceId, {
            ...entry,
            name: file.displayName,
            file: storage.remoteEnabled ? file : undefined,
          });
        }
      }

      const remoteFiles = (await storage.remote?.list()) ?? [];
      const errors = new Set<string>();
      if (storage.remoteListError)
        errors.add(
          `Could not load remote pipelines: ${storage.remoteListError}`,
        );

      // Full definitions preserve the existing metadata and component search.
      for (let offset = 0; offset < remoteFiles.length; offset += 5) {
        await Promise.all(
          remoteFiles.slice(offset, offset + 5).map(async (file) => {
            const entry: PipelineListEntry = {
              name: file.displayName,
              modificationTime: file.modifiedAt,
              file,
            };
            try {
              entry.componentRef = await loadComponentAsRefFromText(
                await file.read(),
              );
              entry.name = file.displayName;
            } catch (error) {
              errors.add(
                `Could not load pipeline details: ${getErrorMessage(error)}`,
              );
            }
            pipelines.set(file.referenceId, entry);
          }),
        );
      }

      return { pipelines, error: [...errors].join(" ") };
    },
  });
}
