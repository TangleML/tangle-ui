import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DiffStatus } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { STATUS_ICON } from "@/routes/v2/pages/Editor/components/UpgradeComponents/components/upgradePreviewConstants";

export const DIFF_STATUS_LABELS: Record<DiffStatus, string> = {
  unchanged: "Unchanged",
  lost: "Removed",
  new: "Added",
  changed: "Changed",
};

const DIFF_STATUS_TONE: Record<DiffStatus, string> = {
  unchanged: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100",
  lost: "bg-red-100 text-red-700 line-through dark:bg-red-950 dark:text-red-200",
  new: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
  changed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
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
        DIFF_STATUS_TONE[status],
        className,
      )}
    >
      {icon && <Icon name={icon.name} size="xs" className={icon.className} />}
      <Text as="span" size="xs" weight="semibold" className="text-inherit">
        {DIFF_STATUS_LABELS[status]}
      </Text>
    </InlineStack>
  );
}
