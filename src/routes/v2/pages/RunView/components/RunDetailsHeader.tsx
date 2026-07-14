import { CopyText } from "@/components/shared/CopyText/CopyText";
import { StatusBar } from "@/components/shared/Status";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ExecutionStatusStats } from "@/utils/executionStatus";

interface RunDetailsHeaderProps {
  pipelineName: string;
  executionStatusStats: ExecutionStatusStats | null | undefined;
  statusLabel: string;
}

export function RunDetailsHeader({
  pipelineName,
  executionStatusStats,
  statusLabel,
}: RunDetailsHeaderProps) {
  return (
    <BlockStack gap="2" className="shrink-0 px-4 pb-2 pt-3">
      <CopyText
        className="text-lg font-semibold"
        copyTrackingAction="v2.run_view.context_panel.run_details_pipeline_title_copy"
      >
        {pipelineName}
      </CopyText>

      <InlineStack
        gap="2"
        blockAlign="center"
        wrap="nowrap"
        className="w-full rounded-md border px-2 py-1"
      >
        <BlockStack gap="1" className="min-w-0 flex-1">
          <Text size="xs" weight="semibold" className="truncate">
            {statusLabel}
          </Text>
          <StatusBar executionStatusStats={executionStatusStats} />
        </BlockStack>
      </InlineStack>
    </BlockStack>
  );
}
