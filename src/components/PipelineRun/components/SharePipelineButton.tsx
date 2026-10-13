import { type ComponentPropsWithoutRef, useCallback } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { copyToClipboard } from "@/utils/string";
import { getRunUrl } from "@/utils/URL";

type SharePipelineButtonProps = {
  runId: string | null | undefined;
  showLabel?: boolean;
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof TooltipButton>,
  "onClick" | "tooltip" | "variant" | "children"
>;

export const SharePipelineButton = ({
  runId,
  showLabel,
  displayLabel,
  showTooltip = true,
  ...rest
}: SharePipelineButtonProps) => {
  const notify = useToastNotification();

  const handleShare = useCallback(() => {
    if (!runId) return;
    copyToClipboard(getRunUrl(runId));
    notify("Run URL copied to clipboard", "success");
  }, [notify, runId]);

  return (
    <TooltipButton
      variant="outline"
      onClick={handleShare}
      disabled={!runId}
      tooltip={showTooltip ? "Share run" : undefined}
      data-testid="share-pipeline-button"
      {...rest}
    >
      <Icon name="Share2" />
      {displayLabel ?? (showLabel ? "Share" : null)}
    </TooltipButton>
  );
};
