import { useSuspenseQuery } from "@tanstack/react-query";

import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineRef } from "@/services/pipelineStorage/types";

export function usePipelineFile(ref: PipelineRef | null, editorId: string) {
  const storage = usePipelineStorage();
  return useSuspenseQuery({
    queryKey: [
      "editor-v2-file",
      storage.scope,
      editorId,
      ref?.fileId ?? ref?.name,
    ],
    queryFn: async () => {
      if (!ref) return null;
      const file = ref.fileId
        ? await storage.findPipelineById(ref.fileId)
        : await storage.resolvePipelineByName(ref.name);
      if (!file) throw new Error(`Pipeline "${ref.name}" not found`);
      return file;
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
