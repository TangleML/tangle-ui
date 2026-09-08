import { useCallback, useEffect, useState } from "react";

import { listPipelineFiles } from "@/services/pipelineStorage/pipelineOperations";

const useLoadUserPipelines = () => {
  const [isLoadingUserPipelines, setIsLoadingUserPipelines] = useState(true);
  const [pipelineNames, setPipelineNames] = useState<string[]>([]);

  const refetch = useCallback(async () => {
    setIsLoadingUserPipelines(true);
    try {
      const files = await listPipelineFiles();
      setPipelineNames(files.map((file) => file.displayName));
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
    } finally {
      setIsLoadingUserPipelines(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { pipelineNames, isLoadingUserPipelines, refetch };
};

export default useLoadUserPipelines;
