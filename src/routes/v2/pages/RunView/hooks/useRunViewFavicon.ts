import { useEffect } from "react";

import { faviconManager, getFaviconStatus } from "@/favicon";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";

export function useRunViewFavicon() {
  const { rootState } = useExecutionData();
  const runStatus = getOverallExecutionStatusFromStats(
    flattenExecutionStatusStats(rootState?.child_execution_status_stats),
  );

  useEffect(() => {
    faviconManager.updateFavicon(getFaviconStatus(runStatus));

    return () => {
      faviconManager.reset();
    };
  }, [runStatus]);
}
