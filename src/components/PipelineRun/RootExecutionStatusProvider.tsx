import { createContext, type PropsWithChildren, useContext } from "react";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
} from "@/api/types.gen";
import { usePipelineRunData } from "@/hooks/usePipelineRunData";

interface RootExecutionStatus {
  details: GetExecutionInfoResponse | undefined;
  state: GetGraphExecutionStateResponse | undefined;
  runId: string | undefined | null;
  isLoading: boolean;
  error: Error | null;
}

const RootExecutionContext = createContext<RootExecutionStatus | null>(null);

export function RootExecutionStatusProvider({
  pipelineRunId,
  children,
}: PropsWithChildren<{ pipelineRunId: string }>) {
  const { executionData, isLoading, error } = usePipelineRunData(pipelineRunId);

  const { details, state } = executionData ?? {};
  const runId = details?.pipeline_run_id;

  const value = {
    details,
    state,
    runId,
    isLoading,
    error,
  };

  return (
    <RootExecutionContext.Provider value={value}>
      {children}
    </RootExecutionContext.Provider>
  );
}

export function useRootExecutionContext() {
  const ctx = useContext(RootExecutionContext);
  if (!ctx)
    throw new Error(
      "useRootExecutionContext must be used within RootExecutionContext",
    );
  return ctx;
}
