import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

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

  return (
    <BlockStack
      fill
      gap="3"
      className="bg-background p-6 text-center"
      data-testid="run-timing-view"
    >
      <Icon
        name="ChartNoAxesGantt"
        size="xl"
        className="text-muted-foreground"
      />
      <Heading level={1}>Run timing</Heading>
      <Paragraph tone="subdued">
        {data?.tasks.length ?? 0} tasks ready for timing analysis.
      </Paragraph>
    </BlockStack>
  );
}
