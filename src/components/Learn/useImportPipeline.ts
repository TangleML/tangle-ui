import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { EDITOR_PATH } from "@/routes/router";

import { importPipelineFromUrl } from "./importPipelineFromUrl";

export function useImportPipeline() {
  const navigate = useNavigate();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async (url: string) => await importPipelineFromUrl(url),
    onSuccess: (result) => {
      notify(`Pipeline "${result.name}" created successfully`, "success");
      navigate({
        to: `${EDITOR_PATH}/${encodeURIComponent(result.name)}`,
      });
    },
  });
}
