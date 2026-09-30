import type { ArtifactNodeResponse } from "@/api/types.gen";
import { useExecutionArtifacts } from "@/hooks/useExecutionArtifacts";
import { usePipelineRunData } from "@/hooks/usePipelineRunData";
import { useBackend } from "@/providers/BackendProvider";
import { outputArtifactsOf } from "@/routes/v2/pages/CompareView/utils/compareArtifacts";
import {
  runDurationMs,
  runOverallStatus,
} from "@/routes/v2/pages/CompareView/utils/runExecutionFacts";
import { useFetchPipelineRunMetadata } from "@/services/executionService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { buildTaskExecutionStatusMap } from "@/utils/executionStatus";

export interface RunComparisonSide {
  runId: string;
  spec: ComponentSpec | undefined;
  taskStatusMap: Map<string, string>;
  taskExecutionIdMap: Map<string, string>;
  outputArtifacts: Record<string, ArtifactNodeResponse> | undefined;
  createdBy?: string;
  createdAt?: string;
  status?: string;
  durationMs?: number;
  runAnnotations?: Record<string, unknown>;
  runArguments?: Record<string, unknown>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Loads a single run's spec, per-task execution status and pipeline-level output
 * artifacts for the comparison view. Safe to call twice in one component (once
 * per side) because `usePipelineRunData` scopes all of its queries by id. Pass
 * an empty string for an unselected side — the underlying queries stay disabled.
 *
 * Only the root execution's artifacts are fetched, which is one request per run
 * however wide the pipeline is. Per-task artifacts stay behind the task rows
 * that ask for them. `outputArtifacts` stays `undefined` until that request
 * succeeds, so a side that is still loading or failed is never mistaken for a
 * run that produced nothing.
 */
export function useRunComparisonSide(runId: string): RunComparisonSide {
  const { configured } = useBackend();
  const { executionData, rootExecutionId, error } = usePipelineRunData(runId);
  const { data: runMetadata } = useFetchPipelineRunMetadata(runId || undefined);
  const { data: artifacts, isSuccess: artifactsLoaded } = useExecutionArtifacts(
    configured ? rootExecutionId : undefined,
  );

  const details = executionData?.details;
  const state = executionData?.state;

  const spec =
    (details?.task_spec.componentRef.spec as
      | ComponentSpec
      | null
      | undefined) ?? undefined;

  const taskStatusMap = buildTaskExecutionStatusMap(details, state);

  const taskExecutionIdMap = new Map<string, string>(
    Object.entries(details?.child_task_execution_ids ?? {}),
  );

  return {
    runId,
    spec,
    taskStatusMap,
    taskExecutionIdMap,
    outputArtifacts: artifactsLoaded ? outputArtifactsOf(artifacts) : undefined,
    createdBy: runMetadata?.created_by ?? undefined,
    createdAt: runMetadata?.created_at ?? undefined,
    status: runOverallStatus(state),
    durationMs: runDurationMs(details),
    runAnnotations: runMetadata?.annotations ?? undefined,
    runArguments: details?.task_spec.arguments ?? undefined,
    isLoading: Boolean(runId) && !executionData && !error,
    error: error ?? null,
  };
}
