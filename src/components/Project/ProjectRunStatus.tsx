import { StatusIcon } from "@/components/shared/Status";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useRunExecutionStats } from "@/services/projects/useProjectRuns";
import {
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";

const SPINNER_SIZE = 14;

export function ProjectRunStatus({ runId }: { runId: string }) {
  const { data, isPending, error } = useRunExecutionStats(runId);

  if (isPending) {
    return <Spinner size={SPINNER_SIZE} />;
  }

  const status = error
    ? undefined
    : getOverallExecutionStatusFromStats(data ?? undefined);

  return (
    <InlineStack gap="1" blockAlign="center" wrap="nowrap">
      <StatusIcon status={status} />
      <Text size="xs" tone="subdued" className="truncate">
        {getExecutionStatusLabel(status)}
      </Text>
    </InlineStack>
  );
}
