import { Button } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
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
      variant="row"
      aria-pressed={isSelected}
      disabled={disabled}
      onClick={onClick}
      {...tracking(trackingId)}
    >
      <Icon name={icon} size="xs" />
      <Text size="sm" className="flex-1 truncate">
        {label}
      </Text>
      {detail && (
        <Text size="xs" tone="subdued" className="truncate">
          {detail}
        </Text>
      )}
    </Button>
  );
}
