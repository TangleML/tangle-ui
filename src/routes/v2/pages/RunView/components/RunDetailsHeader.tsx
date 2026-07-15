import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack } from "@/components/ui/layout";
import type { ExecutionStatusStats } from "@/utils/executionStatus";

import { RunActionsBar } from "./RunActionsBar";

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

      <RunActionsBar
        executionStatusStats={executionStatusStats}
        statusLabel={statusLabel}
      />
    </BlockStack>
  );
}
