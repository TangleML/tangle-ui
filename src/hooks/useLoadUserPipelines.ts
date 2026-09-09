import { useCallback, useEffect, useState } from "react";

import { listPipelineFiles } from "@/services/pipelineStorage/pipelineOperations";

const useLoadUserPipelines = (enabled = true) => {
  const [isLoadingUserPipelines, setIsLoadingUserPipelines] = useState(enabled);
  const [pipelineNames, setPipelineNames] = useState<string[]>([]);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    setIsLoadingUserPipelines(true);
    try {
      const files = await listPipelineFiles();
      setPipelineNames(files.map((file) => file.displayName));
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
    } finally {
      setIsLoadingUserPipelines(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { pipelineNames, isLoadingUserPipelines, refetch };
};

export default useLoadUserPipelines;
