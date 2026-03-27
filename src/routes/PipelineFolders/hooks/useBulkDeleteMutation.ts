import { useMutation } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage, pluralize } from "@/utils/string";

interface BulkDeleteMutationOptions {
  onSettled?: () => void;
}

export function useBulkDeleteMutation({
  onSettled,
}: BulkDeleteMutationOptions = {}) {
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async (pipelineIds: string[]) => {
      await Promise.all(
        pipelineIds.map(async (id) => {
          const file = await storage.findPipelineById(id);
          await file.deleteFile();
        }),
      );
      return pipelineIds.length;
    },
    onSuccess: (deletedCount) => {
      notify(
        `${deletedCount} ${pluralize(deletedCount, "item")} deleted`,
        "success",
      );
      onSettled?.();
    },
    onError: (error) => {
      notify("Failed to delete: " + getErrorMessage(error), "error");
    },
  });
}
