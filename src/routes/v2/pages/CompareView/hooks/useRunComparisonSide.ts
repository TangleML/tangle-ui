import { usePipelineRunData } from "@/hooks/usePipelineRunData";
import type { ComponentSpec } from "@/utils/componentSpec";
import { buildTaskExecutionStatusMap } from "@/utils/executionStatus";

export interface RunComparisonSide {
  runId: string;
  spec: ComponentSpec | undefined;
  taskStatusMap: Map<string, string>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Loads a single run's spec and per-task execution status for the comparison
 * view. Safe to call twice in one component (once per side) because
 * `usePipelineRunData` scopes all of its queries by id. Pass an empty string
 * for an unselected side — the underlying queries stay disabled.
 */
export function useRunComparisonSide(runId: string): RunComparisonSide {
  const { executionData, isLoading, error } = usePipelineRunData(runId);

  const details = executionData?.details;
  const state = executionData?.state;

  const spec = details?.task_spec.componentRef.spec as
    ComponentSpec | undefined;

  const taskStatusMap = buildTaskExecutionStatusMap(details, state);

  return {
    runId,
    spec,
    taskStatusMap,
    isLoading,
    error: error ?? null,
  };
}
