import type { PipelineRunResponse } from "@/api/types.gen";
import { StatusBar, StatusIcon } from "@/components/shared/Status";
import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { formatDate } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { tracking } from "@/utils/tracking";

interface RunPickerRowProps {
  run: PipelineRunResponse;
  onSelect: (runId: string) => void;
}

export function RunPickerRow({ run, onSelect }: RunPickerRowProps) {
  const runId = `${run.id}`;
  const status = getOverallExecutionStatusFromStats(
    run.execution_status_stats ?? undefined,
  );

  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start py-2"
      onClick={() => onSelect(runId)}
      {...tracking("compare_runs.run_picker.select_run")}
    >
      <InlineStack gap="3" blockAlign="center" wrap="nowrap" className="w-full">
        <StatusIcon status={status} />
        <Text
          as="span"
          size="sm"
          className="min-w-48 flex-1 truncate text-left"
        >
          {run.pipeline_name ?? "Unknown pipeline"}
        </Text>
        <Text as="span" size="xs" tone="subdued" className="shrink-0">
          #{runId}
        </Text>
        <div className="w-32 shrink-0">
          <StatusBar executionStatusStats={run.execution_status_stats} />
        </div>
        <Text
          as="span"
          size="xs"
          tone="subdued"
          className="w-28 shrink-0 whitespace-nowrap text-right"
        >
          {run.created_at ? formatDate(run.created_at) : ""}
        </Text>
        <Text
          as="span"
          size="xs"
          tone="subdued"
          className="w-36 shrink-0 truncate text-right"
        >
          {run.created_by ?? ""}
        </Text>
      </InlineStack>
    </Button>
  );
}
