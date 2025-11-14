import { useEffect, useState } from "react";

import { fetchExecutionStatus } from "@/services/executionService";
import { fetchPipelineRuns } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

const useLoadPipelineRuns = (pipelineName: string, backendUrl: string) => {
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null);

  const fetchData = async () => {
    if (!pipelineName) return;

    const res = await fetchPipelineRuns(pipelineName);

    if (!res) return;

    if (res.latestRun) {
      const latestRun = res.latestRun as PipelineRun;

      const runStatus = await fetchExecutionStatus(
        `${latestRun.root_execution_id}`,
        backendUrl,
      );

      latestRun.status = runStatus?.run;

      setLatestRun(latestRun);
    }

    setPipelineRuns(res.runs);
  };

  useEffect(() => {
    fetchData();
  }, [pipelineName]);

  return { pipelineRuns, latestRun, refetch: fetchData };
};

export default useLoadPipelineRuns;
