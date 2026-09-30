import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";

import useToastNotification from "./useToastNotification";

export function useSavePipelineToCloud(file: PipelineFile) {
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const saving = useRef(false);
  const isRetry = file.storageKind === "pending" || !!file.saveError;
  const isSupported =
    storage.remoteEnabled &&
    file.canEdit &&
    (storage.canMigrate(file) || isRetry);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (file.storageKind === "local") {
        await storage.migratePipeline(file);
      } else {
        await file.retry();
      }
    },
    retry: false,
    onSuccess: () => notify("Pipeline saved to server", "success"),
    onError: (error) =>
      notify(`Could not save pipeline to server: ${error.message}`, "error"),
    onSettled: () => {
      saving.current = false;
      void queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
    },
  });

  return {
    isSupported,
    isRetry,
    isPending: isPending || file.isSaving,
    save: () => {
      if (!isSupported || saving.current || file.isSaving) return;
      saving.current = true;
      mutate();
    },
  };
}
