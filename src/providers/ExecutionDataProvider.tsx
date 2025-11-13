import { useQueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useContext, useEffect, useMemo, useRef } from "react";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
} from "@/api/types.gen";
import { usePipelineRunData } from "@/hooks/usePipelineRunData";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import type { BreadcrumbSegment } from "@/hooks/useSubgraphBreadcrumbs";
import { useSubgraphBreadcrumbs } from "@/hooks/useSubgraphBreadcrumbs";
import { convertExecutionStatsToStatusCounts } from "@/services/executionService";
import type { TaskStatusCounts } from "@/types/pipelineRun";

import { useComponentSpec } from "./ComponentSpecProvider";

interface CachedExecutionData {
  executionId: string;
  details: GetExecutionInfoResponse;
  state: GetGraphExecutionStateResponse;
}

interface ExecutionDataContextType {
  currentExecutionId: string | undefined;
  details: GetExecutionInfoResponse | undefined;
  state: GetGraphExecutionStateResponse | undefined;
  rootExecutionId: string | undefined;
  rootDetails: GetExecutionInfoResponse | undefined;
  rootState: GetGraphExecutionStateResponse | undefined;
  runId: string | undefined | null;
  isLoading: boolean;
  error: Error | null;
  taskStatusCountsMap: Map<string, TaskStatusCounts>;
  segments: BreadcrumbSegment[];
}

const ExecutionDataContext = createRequiredContext<ExecutionDataContextType>(
  "ExecutionDataProvider",
);

const PATH_DELIMITER = ".";
const ROOT_PATH_START_INDEX = 1;

const isAtRootLevel = (path: string[]) => path.length <= 1;

const buildPathKey = (path: string[]) => path.join(PATH_DELIMITER);

const buildTaskStatusCountsMap = (
  details?: GetExecutionInfoResponse,
  state?: GetGraphExecutionStateResponse,
): Map<string, TaskStatusCounts> => {
  const taskStatusCountsMap = new Map<string, TaskStatusCounts>();

  if (!details?.child_task_execution_ids) {
    return taskStatusCountsMap;
  }

  Object.entries(details.child_task_execution_ids).forEach(
    ([taskId, executionId]) => {
      const statusStats = state?.child_execution_status_stats?.[executionId];

      if (statusStats) {
        const statusCounts = convertExecutionStatsToStatusCounts(statusStats);
        taskStatusCountsMap.set(taskId, statusCounts);
      }
    },
  );

  return taskStatusCountsMap;
};

const findExecutionIdAtPath = (
  path: string[],
  rootExecutionId: string | undefined,
  rootDetails: GetExecutionInfoResponse | undefined,
  cache: Map<string, CachedExecutionData>,
  queryClient: ReturnType<typeof useQueryClient>,
): string => {
  if (!rootExecutionId) {
    return "";
  }

  let currentId = rootExecutionId;
  let currentDetails = rootDetails;

  for (let i = ROOT_PATH_START_INDEX; i < path.length; i++) {
    const taskId = path[i];
    const pathKey = buildPathKey(path.slice(0, i + 1));

    const cachedData = cache.get(pathKey);
    if (cachedData) {
      currentId = cachedData.executionId;
      currentDetails = cachedData.details;
      continue;
    }

    const nextExecutionId = currentDetails?.child_task_execution_ids?.[taskId];
    if (!nextExecutionId) {
      break;
    }

    currentId = nextExecutionId;

    const cachedQueryData = queryClient.getQueryData<{
      details: GetExecutionInfoResponse;
      state: GetGraphExecutionStateResponse;
    }>(["pipeline-run", nextExecutionId]);

    if (cachedQueryData) {
      currentDetails = cachedQueryData.details;
      cache.set(pathKey, {
        executionId: nextExecutionId,
        details: cachedQueryData.details,
        state: cachedQueryData.state,
      });
    } else {
      currentDetails = undefined;
    }
  }

  return currentId;
};

export function ExecutionDataProvider({
  pipelineRunId,
  subgraphExecutionId,
  children,
}: PropsWithChildren<{
  pipelineRunId: string;
  subgraphExecutionId?: string;
}>) {
  const queryClient = useQueryClient();
  const { currentSubgraphPath, navigateToPath } = useComponentSpec();

  const executionDataCache = useRef<Map<string, CachedExecutionData>>(
    new Map(),
  );

  const {
    executionData,
    rootExecutionId,
    isLoading: isLoadingPipelineRunData,
    error: pipelineRunError,
  } = usePipelineRunData(pipelineRunId);

  const { details: rootDetails, state: rootState } = executionData ?? {};
  const runId = rootDetails?.pipeline_run_id;

  const {
    path: urlDerivedPath,
    segments,
    isLoading: isLoadingBreadcrumbs,
  } = useSubgraphBreadcrumbs(rootExecutionId, subgraphExecutionId);

  // Wait until rootDetails is loaded so the component spec is available
  useEffect(() => {
    // Don't try to navigate until we have the root details loaded
    // This ensures the component spec is set before we validate paths
    if (!rootDetails) {
      return;
    }

    if (subgraphExecutionId && urlDerivedPath.length > 0) {
      const pathsAreEqual =
        currentSubgraphPath.length === urlDerivedPath.length &&
        currentSubgraphPath.every(
          (segment, index) => segment === urlDerivedPath[index],
        );

      if (!pathsAreEqual) {
        navigateToPath(urlDerivedPath);
      }
    } else if (!subgraphExecutionId && currentSubgraphPath.length > 1) {
      navigateToPath(["root"]);
    }
  }, [
    subgraphExecutionId,
    urlDerivedPath,
    currentSubgraphPath,
    navigateToPath,
    rootDetails,
  ]);

  const isAtRoot = isAtRootLevel(currentSubgraphPath);

  const currentExecutionId = useMemo(() => {
    if (subgraphExecutionId) {
      return subgraphExecutionId;
    }

    if (isAtRoot) {
      return rootExecutionId;
    }

    return findExecutionIdAtPath(
      currentSubgraphPath,
      rootExecutionId,
      rootDetails,
      executionDataCache.current,
      queryClient,
    );
  }, [
    subgraphExecutionId,
    currentSubgraphPath,
    rootExecutionId,
    rootDetails,
    isAtRoot,
    queryClient,
  ]);

  const {
    executionData: nestedExecutionData,
    isLoading: isNestedLoading,
    error: nestedError,
  } = usePipelineRunData(currentExecutionId || "");

  const { details: nestedDetails, state: nestedState } =
    nestedExecutionData ?? {};

  const details = isAtRoot ? rootDetails : nestedDetails;
  const state = isAtRoot ? rootState : nestedState;

  // If we have a subgraph execution ID in the URL, we need to wait for breadcrumbs to load
  // before rendering to avoid flashing the root level
  const isLoading = isAtRoot
    ? isLoadingPipelineRunData ||
      (!!subgraphExecutionId && isLoadingBreadcrumbs)
    : isNestedLoading || isLoadingBreadcrumbs;
  const error = isAtRoot ? pipelineRunError : nestedError;

  useEffect(() => {
    if (!nestedDetails || !nestedState || isAtRoot) {
      return;
    }

    const pathKey = buildPathKey(currentSubgraphPath);
    executionDataCache.current.set(pathKey, {
      executionId: currentExecutionId || "",
      details: nestedDetails,
      state: nestedState,
    });
  }, [
    nestedDetails,
    nestedState,
    currentExecutionId,
    currentSubgraphPath,
    isAtRoot,
  ]);

  const taskStatusCountsMap = useMemo(
    () => buildTaskStatusCountsMap(details, state),
    [details, state],
  );

  const value = useMemo(
    () => ({
      currentExecutionId,
      details,
      state,
      rootExecutionId,
      rootDetails,
      rootState,
      runId,
      isLoading,
      error,
      taskStatusCountsMap,
      segments,
    }),
    [
      currentExecutionId,
      details,
      state,
      rootExecutionId,
      rootDetails,
      rootState,
      runId,
      isLoading,
      error,
      taskStatusCountsMap,
      segments,
    ],
  );

  return (
    <ExecutionDataContext.Provider value={value}>
      {children}
    </ExecutionDataContext.Provider>
  );
}

export function useExecutionData() {
  return useRequiredContext(ExecutionDataContext);
}

/**
 * Optional version of useExecutionData that returns undefined if provider is not present.
 * Use in components that work in both editor and run contexts.
 */
export function useExecutionDataOptional() {
  const context = useContext(ExecutionDataContext);
  return context || undefined;
}
