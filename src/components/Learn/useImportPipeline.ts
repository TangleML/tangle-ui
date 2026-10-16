import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import { importPipelineFromUrl } from "./importPipelineFromUrl";

export function useImportPipeline() {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async (url: string) => {
      const result = await importPipelineFromUrl(storage, url);
      if (!result.successful)
        throw new Error(result.errorMessage ?? "Failed to import pipeline.");
      return result;
    },
    onError: (error) => notify(error.message, "error"),
    onSuccess: (result) => {
      notify(`Pipeline "${result.name}" created successfully`, "success");
      navigate({
        to: result.url ?? getDefaultEditorPath(result.name),
      });
    },
  });
}
