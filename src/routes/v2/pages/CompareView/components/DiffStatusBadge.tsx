import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DiffStatus } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import {
  DIFF_STATUS_CLASSES,
  STATUS_ICON,
} from "@/routes/v2/pages/Editor/components/UpgradeComponents/components/upgradePreviewConstants";

const DIFF_STATUS_LABELS: Record<DiffStatus, string> = {
  unchanged: "Unchanged",
  lost: "Removed",
  new: "Added",
  changed: "Changed",
};

interface DiffStatusBadgeProps {
  status: DiffStatus;
  className?: string;
}

export function DiffStatusBadge({ status, className }: DiffStatusBadgeProps) {
  const icon = STATUS_ICON[status];

  return (
    <InlineStack
      as="span"
      gap="1"
      blockAlign="center"
      wrap="nowrap"
      className={cn(
        "rounded px-1.5 py-0.5",
        DIFF_STATUS_CLASSES[status],
        className,
      )}
    >
      {icon && <Icon name={icon.name} size="xs" className={icon.className} />}
      <Text as="span" size="xs" weight="semibold">
        {DIFF_STATUS_LABELS[status]}
      </Text>
    </InlineStack>
  );
}
