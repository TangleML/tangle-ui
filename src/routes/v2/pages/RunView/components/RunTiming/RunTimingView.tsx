import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

import { RunTimingChart, RunTimingChartLegend } from "./RunTimingChart";
import { RunTimingSummary } from "./RunTimingSummary";
import { useRunTimingData } from "./useRunTimingData";

export function RunTimingView() {
  const { rootDetails, rootState, metadata } = useExecutionData();
  const runComplete = isExecutionComplete(
    flattenExecutionStatusStats(rootState?.child_execution_status_stats),
  );
  const { data, error, isLoading } = useRunTimingData({
    rootDetails,
    runCreatedAt: metadata?.created_at,
    runComplete,
  });

  if (isLoading) return <LoadingScreen message="Loading run timing..." />;

  if (error) {
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
            <Heading level={1}>Run timing</Heading>
            <Paragraph tone="subdued" size="sm">
              Explore where this run spent time across task phases.
            </Paragraph>
          </BlockStack>
          <RunTimingChartLegend />
        </InlineStack>
        <RunTimingSummary metrics={data.metrics} />
      </BlockStack>

      <BlockStack
        align="stretch"
        className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden p-4"
      >
        <RunTimingChart data={data} />
      </BlockStack>
    </BlockStack>
  );
}
