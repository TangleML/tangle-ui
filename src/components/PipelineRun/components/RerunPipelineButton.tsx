import type { ComponentPropsWithoutRef } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { useRerunPipelineRun } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";

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
  const { rerun, isRerunning, canRerun, review } =
    useRerunPipelineRun(componentSpec);

  return (
    <>
      <TooltipButton
        variant="outline"
        onClick={rerun}
        tooltip={showTooltip ? "Rerun pipeline" : undefined}
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
