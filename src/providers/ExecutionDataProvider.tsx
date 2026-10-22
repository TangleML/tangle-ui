import type { PropsWithChildren } from "react";
import { useContext, useMemo } from "react";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { useGraphExecutionData } from "@/hooks/useGraphExecutionData";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import type { BreadcrumbSegment } from "@/hooks/useSubgraphBreadcrumbs";
import { useSubgraphBreadcrumbs } from "@/hooks/useSubgraphBreadcrumbs";
import { useFetchPipelineRunMetadata } from "@/services/executionService";
import { buildTaskExecutionStatusMap } from "@/utils/executionStatus";

interface ExecutionDataContextType {
  currentExecutionId: string | undefined;
  subgraphExecutionId: string | undefined;
  details: GetExecutionInfoResponse | undefined;
  state: GetGraphExecutionStateResponse | undefined;
  rootExecutionId: string | undefined;
  rootDetails: GetExecutionInfoResponse | undefined;
  rootState: GetGraphExecutionStateResponse | undefined;
  runId: string | undefined | null;
  metadata: PipelineRunResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  taskExecutionStatusMap: Map<string, string>;
  segments: BreadcrumbSegment[];
}

const ExecutionDataContext = createRequiredContext<ExecutionDataContextType>(
  "ExecutionDataProvider",
);

/** The route or embedded view owns the execution ID; query data is derived from it. */
export function ExecutionDataProvider({
  pipelineRunId,
  subgraphExecutionId,
  children,
}: PropsWithChildren<{
  pipelineRunId: string;
  subgraphExecutionId?: string;
}>) {
  const metadata = useFetchPipelineRunMetadata(pipelineRunId);
  const rootExecutionId = metadata.data?.root_execution_id;
  const root = useGraphExecutionData(rootExecutionId);
  const nested = useGraphExecutionData(subgraphExecutionId);
  const { details: rootDetails, state: rootState } = root;
  const runId = metadata.data?.id;
  const current = subgraphExecutionId ? nested : root;
  const { details, state } = current;
  const breadcrumbs = useSubgraphBreadcrumbs(
    rootExecutionId,
    subgraphExecutionId,
  );
  const currentExecutionId = subgraphExecutionId ?? rootExecutionId;
  const isLoading =
    root.isLoading ||
    current.isLoading ||
    metadata.isLoading ||
    breadcrumbs.isLoading;
  const error =
    root.error ?? current.error ?? metadata.error ?? breadcrumbs.error;
  const taskExecutionStatusMap = useMemo(
    () => buildTaskExecutionStatusMap(details, state),
    [details, state],
  );

  const value = useMemo(
    () => ({
      currentExecutionId,
      subgraphExecutionId,
      details,
      state,
      rootExecutionId,
      rootDetails,
      rootState,
      runId,
      metadata: metadata.data,
      isLoading,
      error,
      taskExecutionStatusMap,
      segments: breadcrumbs.segments,
    }),
    [
      currentExecutionId,
      subgraphExecutionId,
      details,
      state,
      rootExecutionId,
      rootDetails,
      rootState,
      runId,
      metadata.data,
      isLoading,
      error,
      taskExecutionStatusMap,
      breadcrumbs.segments,
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

export function useExecutionDataOptional() {
  return useContext(ExecutionDataContext) ?? undefined;
}
