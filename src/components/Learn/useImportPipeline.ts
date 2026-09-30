import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import { importPipelineFromUrl } from "./importPipelineFromUrl";

export function useImportPipeline() {
  const storage = usePipelineStorage();
  const navigate = useNavigate();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async (url: string) =>
      await importPipelineFromUrl(storage, url),
    onSuccess: (result) => {
      notify(`Pipeline "${result.name}" created successfully`, "success");
      navigate({
        to: getDefaultEditorPath(result.referenceId ?? result.name),
      });
    },
  });
}
