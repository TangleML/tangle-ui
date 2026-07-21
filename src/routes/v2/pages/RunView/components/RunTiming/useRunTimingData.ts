import { Query, useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import type { GetExecutionInfoResponse } from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";

import { fetchRunTimingData } from "./runTimingService";

const REFRESH_INTERVAL_MS = 5_000;
const COMPLETED_RUN_STABLE_REFRESHES = 2;

interface CompletedRunRefreshState {
  dataUpdatedAt: number;
  taskSignature: string;
  stableRefreshes: number;
}

interface UseRunTimingDataOptions {
  rootDetails: GetExecutionInfoResponse | undefined;
  runCreatedAt: string | null | undefined;
  runComplete: boolean;
}

export function useRunTimingData({
  rootDetails,
  runCreatedAt,
  runComplete,
}: UseRunTimingDataOptions) {
  const { backendUrl } = useBackend();
  const completedRunRefreshState = useRef<CompletedRunRefreshState>(undefined);

  return useQuery({
    queryKey: ["run-timing", backendUrl, rootDetails?.id, runCreatedAt],
    queryFn: ({ signal }) => {
      if (!rootDetails)
        throw new Error("Run execution details are unavailable");
      return fetchRunTimingData({
        rootDetails,
        backendUrl,
        runCreatedAt,
        signal,
      });
    },
    enabled: rootDetails !== undefined,
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: (query) => {
      if (!runComplete) return REFRESH_INTERVAL_MS;
      if (!(query instanceof Query) || !query.state.data) {
        return REFRESH_INTERVAL_MS;
      }

      const previous = completedRunRefreshState.current;
      if (previous?.dataUpdatedAt === query.state.dataUpdatedAt) {
        return previous.stableRefreshes >= COMPLETED_RUN_STABLE_REFRESHES
          ? false
          : REFRESH_INTERVAL_MS;
      }

      const taskSignature = JSON.stringify(
        query.state.data.tasks
          .map((task) => ({
            executionId: task.executionId,
            status: task.status,
            readyAt: task.readyAt,
            startAt: task.startAt,
            endAt: task.endAt,
            durationMs: task.durationMs,
            cacheState: task.cacheState,
            timingQuality: task.timingQuality,
            phases: task.phases,
          }))
          .sort((left, right) =>
            left.executionId.localeCompare(right.executionId),
          ),
      );
      completedRunRefreshState.current = {
        dataUpdatedAt: query.state.dataUpdatedAt,
        taskSignature,
        stableRefreshes:
          previous?.taskSignature === taskSignature
            ? previous.stableRefreshes + 1
            : 0,
      };

      return completedRunRefreshState.current.stableRefreshes >=
        COMPLETED_RUN_STABLE_REFRESHES
        ? false
        : REFRESH_INTERVAL_MS;
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof RemoteAuthError) && failureCount < 3,
  });
}
