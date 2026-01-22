import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useRunsById } from "@/hooks/useRunsById";
import type { CompareSearchParams } from "@/routes/router";
import type { PipelineRun } from "@/types/pipelineRun";

import { ComparisonView } from "./Diff";
import { RunSelector } from "./RunSelector";

/**
 * Parse run IDs from URL search param
 */
function parseRunIds(runsParam: string | undefined): string[] {
  if (!runsParam) return [];
  return runsParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Sort runs chronologically (earliest first).
 * This ensures consistent diff semantics: newer runs show additions relative to older runs.
 */
function sortRunsChronologically(runs: PipelineRun[]): PipelineRun[] {
  return [...runs].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateA - dateB;
  });
}

/**
 * Main page for comparing pipeline runs.
 * State is persisted in URL for shareability.
 * URL format: /compare?runs=123,456,789&pipeline=MyPipeline
 */
export const ComparePage = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const search = useSearch({ strict: false }) as CompareSearchParams;

  // Parse run IDs from URL
  const runIdsFromUrl = useMemo(() => parseRunIds(search.runs), [search.runs]);

  // Fetch runs by IDs if present in URL
  const {
    runs: fetchedRuns,
    isLoading,
    notFoundIds,
    isReady,
  } = useRunsById(runIdsFromUrl);

  // Determine view state based on URL
  const showComparison = runIdsFromUrl.length >= 2;

  const handleCompare = (runs: PipelineRun[]) => {
    // Sort runs chronologically before storing in URL
    const sortedRuns = sortRunsChronologically(runs);
    const runIds = sortedRuns.map((r) => String(r.id)).join(",");
    const pipelineName = sortedRuns[0]?.pipeline_name;

    navigate({
      to: pathname,
      search: {
        runs: runIds,
        pipeline: pipelineName,
      } as CompareSearchParams,
    });
  };

  const handleBack = () => {
    // Clear runs from URL but keep pipeline for convenience
    navigate({
      to: pathname,
      search: {
        pipeline: search.pipeline,
      } as CompareSearchParams,
    });
  };

  // Loading state when fetching runs from URL
  if (showComparison && isLoading) {
    return <LoadingScreen message="Loading runs for comparison..." />;
  }

  // Error state if some runs weren't found
  const hasNotFoundError = showComparison && notFoundIds.length > 0;

  return (
    <div className="container mx-auto w-3/4 p-4">
      <BlockStack gap="4">
        <BlockStack gap="1">
          <Text as="h1" size="2xl" weight="bold">
            Compare Runs
          </Text>
          {!showComparison && (
            <Text as="p" tone="subdued">
              Select a pipeline and compare up to 3 runs to see differences in
              arguments and tasks.
            </Text>
          )}
        </BlockStack>

        {/* Warning if some runs weren't found */}
        {hasNotFoundError && (
          <div className="border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4">
            <InlineStack gap="2" blockAlign="center">
              <Icon name="TriangleAlert" className="w-5 h-5 text-yellow-600" />
              <Text>
                Could not find {notFoundIds.length === 1 ? "run" : "runs"}:{" "}
                {notFoundIds.join(", ")}
              </Text>
            </InlineStack>
          </div>
        )}

        {/* Show selector if not enough runs, or comparison if ready */}
        {!showComparison || !isReady ? (
          <RunSelector
            onCompare={handleCompare}
            initialPipelineName={search.pipeline}
          />
        ) : (
          <ComparisonView
            runs={sortRunsChronologically(fetchedRuns)}
            onBack={handleBack}
          />
        )}
      </BlockStack>
    </div>
  );
};
