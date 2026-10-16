import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultEditorPath } from "@/routes/editorRoutes";

import { importPipelineFromUrl } from "./importPipelineFromUrl";

export function useImportPipeline() {
  const navigate = useNavigate();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async (url: string) => {
      const result = await importPipelineFromUrl(url);
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
