import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";

export function ComponentLibraryWindowMiniContent() {
  return (
    <TooltipButton
      tooltip="View Component Library"
      tooltipSide="right"
      variant="outline"
      size="icon"
      aria-label="Components"
    >
      <Icon name="LayoutGrid" size="sm" tone="subdued" />
    </TooltipButton>
  );
}
