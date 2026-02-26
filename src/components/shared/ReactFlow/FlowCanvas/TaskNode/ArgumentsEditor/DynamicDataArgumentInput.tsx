import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon, type IconName } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface DynamicDataArgumentInputProps {
  displayValue: string | null;
  icon: IconName;
  isRemoved?: boolean;
  disabled?: boolean;
  onClear: () => void;
}

const ICON_COLOR_MAP: Record<string, string> = {
  Lock: "text-amber-600",
  Network: "text-blue-600",
  Zap: "text-purple-600",
};

export const DynamicDataArgumentInput = ({
  displayValue,
  icon,
  onClear,
  isRemoved = false,
  disabled = false,
}: DynamicDataArgumentInputProps) => {
  const iconColor = ICON_COLOR_MAP[icon] ?? "text-purple-600";

  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className={cn(
        "w-full px-3 py-1 rounded-md border",
        isRemoved && "opacity-50",
      )}
      data-testid="dynamic-data-argument-input"
      data-secret-name={displayValue}
    >
      <Icon name={icon} size="sm" className={cn(iconColor, "shrink-0")} />
      <Paragraph size="sm" className={cn("truncate flex-1", iconColor)}>
        {displayValue}
      </Paragraph>
      {!disabled && (
        <TooltipButton
          onClick={onClear}
          variant="ghost"
          size="xs"
          tooltip="Clear Dynamic Data"
          className="shrink-0"
        >
          <Icon name="X" size="sm" />
        </TooltipButton>
      )}
    </InlineStack>
  );
};
