import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Paragraph } from "@/components/ui/typography";
import type { PipelineRun } from "@/types/pipelineRun";
import { formatDate } from "@/utils/date";

import { PipelineRunStatus } from "./components/PipelineRunStatus";

export const PipelineRunInfoCondensed = withSuspenseWrapper(
  ({ run }: { run: PipelineRun }) => {
    return (
      <InlineStack gap="2">
        <PipelineRunStatus run={run} />
        <Paragraph tone="subdued" size="xs">
          {formatDate(run.created_at)}
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
