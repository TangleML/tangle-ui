import { useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { RemoteAuthErrorView } from "@/components/shared/RemoteAuthErrorView";
import { Badge } from "@/components/ui/badge";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";

import type { RunTimingTask } from "./runTiming.types";
import { RunTimingChart, RunTimingChartLegend } from "./RunTimingChart";
import { RunTimingSummary } from "./RunTimingSummary";
import { RunTimingToolbar } from "./RunTimingToolbar";
import { useRunTimingData } from "./useRunTimingData";

export function RunTimingView() {
  const [taskFilter, setTaskFilter] = useState("");
  const [criticalPathOnly, setCriticalPathOnly] = useState(false);
  const { editor, navigation } = useSharedStores();
  const { rootDetails, rootState, metadata } = useExecutionData();
  const runComplete = isExecutionComplete(
    flattenExecutionStatusStats(rootState?.child_execution_status_stats),
  );
  const { data, error, isFetching, isLoading, refetch } = useRunTimingData({
    rootDetails,
    runCreatedAt: metadata?.created_at,
    runComplete,
  });

  const handleTaskSelect = (task: RunTimingTask) => {
    const rootName = navigation.rootSpec?.name;
    if (!rootName) return;

    const targetSpec = navigation.navigateToPath([
      rootName,
      ...task.navigationPath.slice(1),
    ]);
    const targetTask = targetSpec?.tasks.find(
      (candidate) => candidate.name === task.taskId,
    );
    if (!targetTask) return;

    editor.selectNode(targetTask.$id, "task", { entityId: targetTask.$id });
  };

  if (isLoading) return <LoadingScreen message="Loading run timing..." />;

  if (error) {
    if (error instanceof RemoteAuthError) return <RemoteAuthErrorView />;

    return (
      <BlockStack fill className="bg-background p-6">
        <InfoBox title="Unable to load run timing" variant="error">
          {error.message}
        </InfoBox>
      </BlockStack>
    );
  }

  if (!data) return null;

  return (
    <BlockStack
      className="h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden bg-background"
      data-testid="run-timing-view"
    >
      <BlockStack gap="4" className="shrink-0 border-b p-4">
        <InlineStack align="space-between" blockAlign="end" wrap="wrap" gap="3">
          <BlockStack gap="1">
            <InlineStack gap="2" wrap="nowrap" blockAlign="center">
              <Heading level={1}>Run timing</Heading>
              <Badge variant="secondary" size="sm">
                Beta
              </Badge>
            </InlineStack>
            <Paragraph tone="subdued" size="sm">
              Explore where this run spent time across task phases.
            </Paragraph>
          </BlockStack>
          <RunTimingChartLegend />
        </InlineStack>
        {data.truncated && (
          <InfoBox title="Timing view limited" variant="warning">
            This beta view shows the first 250 task executions. Timing totals
            may be incomplete.
          </InfoBox>
        )}
        <RunTimingSummary metrics={data.metrics} />
        <RunTimingToolbar
          taskFilter={taskFilter}
          criticalPathOnly={criticalPathOnly}
          refreshing={isFetching && !isLoading}
          onTaskFilterChange={setTaskFilter}
          onCriticalPathOnlyChange={setCriticalPathOnly}
          onRefresh={() => void refetch()}
        />
      </BlockStack>

      <BlockStack
        align="stretch"
        className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden p-4"
      >
        <RunTimingChart
          data={data}
          taskFilter={taskFilter}
          criticalPathOnly={criticalPathOnly}
          onTaskSelect={handleTaskSelect}
        />
      </BlockStack>
    </BlockStack>
  );
}
