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
          queryKey: FoldersQueryKeys.All(),
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

      const pendingFiles = (await storage.remote?.listPending()) ?? [];
      const errors = new Set<string>();
      for (let offset = 0; offset < pendingFiles.length; offset += 5) {
        await Promise.all(
          pendingFiles.slice(offset, offset + 5).map(async (file) => {
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
