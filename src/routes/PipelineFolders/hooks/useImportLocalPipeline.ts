import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/router";
import { storeFileHandle } from "@/services/fileHandleRegistry";
import { importPipelineFromYaml } from "@/services/pipelineService";
import { getErrorMessage } from "@/utils/string";

interface ImportLocalPipelineVariables {
  fileHandle: FileSystemFileHandle;
  fileName: string;
}

export function useImportLocalPipeline() {
  const navigate = useNavigate();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async ({ fileHandle }: ImportLocalPipelineVariables) => {
      const file = await fileHandle.getFile();
      const yamlContent = await file.text();
      const result = await importPipelineFromYaml(yamlContent);

      if (!result.successful) {
        throw new Error(result.errorMessage ?? "Failed to import pipeline");
      }

      await storeFileHandle(result.name, fileHandle);
      return result.name;
    },
    onSuccess: (pipelineName) => {
      notify(`Imported "${pipelineName}"`, "success");
      navigate({
        to: `${APP_ROUTES.EDITOR_V2}/${encodeURIComponent(pipelineName)}`,
      });
    },
    onError: (error) => {
      notify("Import failed: " + getErrorMessage(error), "error");
    },
  });
}
