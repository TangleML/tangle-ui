import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Paragraph } from "@/components/ui/typography";
import type { PipelineRun } from "@/types/pipelineRun";
import { convertUTCToLocalTime, formatDate } from "@/utils/date";

import { PipelineRunStatus } from "./components/PipelineRunStatus";

export const PipelineRunInfoCondensed = withSuspenseWrapper(
  ({ run }: { run: PipelineRun }) => {
    return (
      <InlineStack gap="2">
        <PipelineRunStatus run={run} />
        <Paragraph tone="subdued" size="xs">
          {formatDate(convertUTCToLocalTime(run.created_at).toISOString())}
        </Paragraph>
      </InlineStack>
    );
  },
  () => {
    return (
      <InlineStack gap="2">
        <Skeleton size="sm" />
      </InlineStack>
    );
  },
);
