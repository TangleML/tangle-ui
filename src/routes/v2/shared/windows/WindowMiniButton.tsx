import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon, type IconName } from "@/components/ui/icon";

interface WindowMiniButtonProps {
  tooltip: string;
  label: string;
  icon: IconName;
}

export function WindowMiniButton({
  tooltip,
  label,
  icon,
}: WindowMiniButtonProps) {
  return (
    <TooltipButton
      tooltip={tooltip}
      tooltipSide="right"
      variant="outline"
      size="icon"
      aria-label={label}
    >
      <Icon name={icon} size="sm" className="text-muted-foreground" />
    </TooltipButton>
  );
}
