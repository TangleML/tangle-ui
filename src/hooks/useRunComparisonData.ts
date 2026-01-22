import { useQueries } from "@tanstack/react-query";
import yaml from "js-yaml";

import type {
  GetExecutionInfoResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchExecutionDetails,
  fetchPipelineRun,
} from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import { type ComponentSpec, isValidComponentSpec } from "@/utils/componentSpec";
import type { RunComparisonData } from "@/utils/diff/types";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

/**
 * Extract ComponentSpec from execution details
 */
function extractComponentSpec(
  details: GetExecutionInfoResponse | undefined,
): ComponentSpec | undefined {
  if (!details?.task_spec?.componentRef?.spec) {
    return undefined;
  }

  const spec = details.task_spec.componentRef.spec;
  if (isValidComponentSpec(spec)) {
    return spec as ComponentSpec;
  }

  // Try parsing from text if spec is stored as string
  const text = details.task_spec.componentRef.text;
  if (text) {
    try {
      const parsed = yaml.load(text);
      if (isValidComponentSpec(parsed)) {
        return parsed as ComponentSpec;
      }
    } catch {
      // Failed to parse
    }
  }

  return undefined;
}

/**
 * Transform fetched data into RunComparisonData format
 */
function transformToComparisonData(
  run: PipelineRun,
  metadata: PipelineRunResponse | undefined,
  details: GetExecutionInfoResponse | undefined,
): RunComparisonData {
  const componentSpec = extractComponentSpec(details);

  // Get status from execution stats
  let status: string | undefined;
  if (metadata?.execution_status_stats) {
    status = getOverallExecutionStatusFromStats(metadata.execution_status_stats);
  } else if (details) {
    // Try to derive from other data
    status = run.status;
  }

  return {
    runId: String(run.id),
    pipelineName: run.pipeline_name,
    createdAt: run.created_at,
    createdBy: metadata?.created_by ?? run.created_by,
    status,
    arguments: details?.task_spec?.arguments as
      | Record<string, import("@/utils/componentSpec").ArgumentType>
      | undefined,
    componentSpec,
  };
}

/**
 * Hook to fetch comparison data for multiple pipeline runs
 */
export function useRunComparisonData(runs: PipelineRun[]) {
  const { backendUrl, ready } = useBackend();

  // Fetch metadata for all runs
  const metadataQueries = useQueries({
    queries: runs.map((run) => ({
      queryKey: ["comparison-metadata", run.id],
      queryFn: () => fetchPipelineRun(String(run.id), backendUrl),
      enabled: ready && runs.length > 0,
      staleTime: Infinity,
    })),
  });

  // Extract root execution IDs from metadata
  const rootExecutionIds = metadataQueries.map((query) => ({
    rootExecutionId: query.data?.root_execution_id,
  }));

  // Fetch execution details for all runs
  const detailsQueries = useQueries({
    queries: rootExecutionIds.map(({ rootExecutionId }) => ({
      queryKey: ["comparison-details", rootExecutionId],
      queryFn: () =>
        rootExecutionId
          ? fetchExecutionDetails(rootExecutionId, backendUrl)
          : Promise.resolve(undefined),
      enabled: ready && !!rootExecutionId,
      staleTime: Infinity,
    })),
  });

  // Combine all data
  const isLoading =
    metadataQueries.some((q) => q.isLoading) ||
    detailsQueries.some((q) => q.isLoading);

  const error =
    metadataQueries.find((q) => q.error)?.error ||
    detailsQueries.find((q) => q.error)?.error;

  const comparisonData: RunComparisonData[] = runs.map((run, index) => {
    const metadata = metadataQueries[index]?.data;
    const details = detailsQueries[index]?.data;
    return transformToComparisonData(run, metadata, details);
  });

  const isReady =
    !isLoading &&
    !error &&
    comparisonData.every((data) => data.runId);

  return {
    comparisonData,
    isLoading,
    error,
    isReady,
  };
}

/**
 * Simpler hook for when backend is not available - uses only local data
 */
export function useLocalRunComparisonData(runs: PipelineRun[]) {
  // For local runs, we only have basic metadata
  const comparisonData: RunComparisonData[] = runs.map((run) => ({
    runId: String(run.id),
    pipelineName: run.pipeline_name,
    createdAt: run.created_at,
    createdBy: run.created_by,
    status: run.status,
    arguments: undefined,
    componentSpec: undefined,
  }));

  return {
    comparisonData,
    isLoading: false,
    error: null,
    isReady: runs.length > 0,
  };
}

