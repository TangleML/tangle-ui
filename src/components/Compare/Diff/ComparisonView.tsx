import { useMemo } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { useRunComparisonData } from "@/hooks/useRunComparisonData";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/router";
import type { PipelineRun } from "@/types/pipelineRun";
import { formatDate } from "@/utils/date";
import { compareRuns } from "@/utils/diff/compareRuns";

import { ArgumentsDiff } from "./ArgumentsDiff";
import { TasksVisualDiff } from "./TasksVisualDiff";

interface ComparisonViewProps {
  runs: PipelineRun[];
  onBack: () => void;
}

/**
 * Generate run labels for display (e.g., "Run #123 (Jan 1)")
 */
function generateRunLabels(runs: PipelineRun[]): string[] {
  return runs.map((run) => {
    const date = run.created_at ? formatDate(run.created_at) : "Unknown date";
    return `Run #${run.id} (${date})`;
  });
}

export const ComparisonView = ({ runs, onBack }: ComparisonViewProps) => {
  const { ready } = useBackend();
  const { comparisonData, isLoading, error, isReady } =
    useRunComparisonData(runs);

  const runLabels = useMemo(() => generateRunLabels(runs), [runs]);

  const diffResult = useMemo(() => {
    if (!isReady || comparisonData.length < 2) {
      return null;
    }
    try {
      return compareRuns(comparisonData);
    } catch (e) {
      console.error("Failed to compute diff:", e);
      return null;
    }
  }, [comparisonData, isReady]);

  if (!ready) {
    return (
      <BlockStack gap="4" className="p-4">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Back to selection
        </Button>
        <div className="border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4">
          <InlineStack gap="2" blockAlign="center">
            <Icon name="TriangleAlert" className="w-5 h-5 text-yellow-600" />
            <Text>
              Backend is not configured. Full comparison requires a connected
              backend to fetch execution details.
            </Text>
          </InlineStack>
        </div>
        <Text tone="subdued">
          Basic metadata comparison is shown below based on locally available
          data.
        </Text>
      </BlockStack>
    );
  }

  if (isLoading) {
    return <LoadingScreen message="Loading run details for comparison..." />;
  }

  if (error) {
    return (
      <BlockStack gap="4" className="p-4">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Back to selection
        </Button>
        <div className="border border-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg p-4">
          <InlineStack gap="2" blockAlign="center">
            <Icon name="CircleAlert" className="w-5 h-5 text-red-600" />
            <Text>Failed to load run details: {String(error)}</Text>
          </InlineStack>
        </div>
      </BlockStack>
    );
  }

  if (!diffResult) {
    return (
      <BlockStack gap="4" className="p-4">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Back to selection
        </Button>
        <div className="border border-dashed border-border rounded-lg p-4">
          <Text tone="subdued">Unable to compute comparison.</Text>
        </div>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="6" className="w-full">
      {/* Header */}
      <InlineStack align="space-between" blockAlign="center">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Back to selection
        </Button>
        <Text size="sm" tone="subdued">
          Comparing {runs.length} runs
        </Text>
      </InlineStack>

      {/* Run info cards */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${runs.length}, minmax(200px, 1fr))`,
        }}
      >
        {runs.map((run, index) => (
          <div
            key={run.id}
            className="border rounded-lg p-3 bg-muted/30 h-full"
          >
            <BlockStack gap="1">
              <a
                href={`${APP_ROUTES.RUNS}/${run.id}`}
                className="text-sm font-semibold hover:underline text-primary"
              >
                {runLabels[index]}
              </a>
              <Text
                size="xs"
                tone="subdued"
                className="truncate"
                title={run.pipeline_name}
              >
                {run.pipeline_name}
              </Text>
              <Text size="xs" tone="subdued">
                Status: {run.status || "Unknown"}
              </Text>
            </BlockStack>
          </div>
        ))}
      </div>

      <Separator />

      {/* Arguments Diff */}
      <ArgumentsDiff arguments={diffResult.arguments} runLabels={runLabels} />

      <Separator />

      {/* Tasks Visual Diff */}
      <TasksVisualDiff
        comparisonData={comparisonData}
        tasksDiff={diffResult.tasks}
        runLabels={runLabels}
      />
    </BlockStack>
  );
};
