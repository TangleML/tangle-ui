import type { ComponentPropsWithoutRef } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { useRerunPipelineRun } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";

import { RerunBlockedReason } from "./RerunBlockedReason";
import { RerunReviewDialog } from "./RerunReviewDialog";

type RerunPipelineButtonProps = {
  componentSpec: ComponentSpec;
  showLabel?: boolean;
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof TooltipButton>,
  "onClick" | "tooltip" | "variant" | "children"
>;

export const RerunPipelineButton = ({
  componentSpec,
  showLabel,
  displayLabel,
  showTooltip = true,
  ...rest
}: RerunPipelineButtonProps) => {
  const { rerun, isRerunning, canRerun, blocked, review } =
    useRerunPipelineRun(componentSpec);

  const tooltip = blocked ? (
    <RerunBlockedReason block={blocked} />
  ) : (
    showTooltip && "Rerun pipeline"
  );

  return (
    <>
      <TooltipButton
        variant="outline"
        onClick={rerun}
        tooltip={tooltip}
        disabled={isRerunning || !canRerun}
        data-testid="rerun-pipeline-button"
        {...rest}
      >
        <Icon name="RefreshCcw" />
        {displayLabel ?? (showLabel ? "Rerun" : null)}
      </TooltipButton>
      <RerunReviewDialog review={review} />
    </>
  );
};
