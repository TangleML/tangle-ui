import { Button } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

interface PickerOptionProps {
  icon: IconName;
  label: string;
  detail?: string;
  isSelected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  trackingId: string;
}

export function PickerOption({
  icon,
  label,
  detail,
  isSelected,
  disabled,
  onClick,
  trackingId,
}: PickerOptionProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isSelected}
      disabled={disabled}
      className={cn(
        "h-auto w-full justify-start py-2",
        isSelected && "bg-accent hover:bg-accent",
      )}
      onClick={onClick}
      {...tracking(trackingId)}
    >
      <InlineStack gap="2" blockAlign="center" wrap="nowrap" className="w-full">
        <Icon name={icon} size="xs" className="shrink-0" />
        <Text size="sm" className="flex-1 truncate text-left">
          {label}
        </Text>
        {detail && (
          <Text size="xs" tone="subdued" className="truncate">
            {detail}
          </Text>
        )}
      </InlineStack>
    </Button>
  );
}
