import { useMutation } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { deletePipeline } from "@/services/pipelineService";
import { getErrorMessage, pluralize } from "@/utils/string";

interface BulkDeleteMutationOptions {
  onSettled?: () => void;
}

export function useBulkDeleteMutation({
  onSettled,
}: BulkDeleteMutationOptions = {}) {
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async (pipelineNames: string[]) => {
      await Promise.all(pipelineNames.map((name) => deletePipeline(name)));
      return pipelineNames.length;
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
