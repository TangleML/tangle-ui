import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ChangeType, ValueDiff } from "@/utils/diff/types";

const changeTypeStyles: Record<ChangeType, string> = {
  added: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  removed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  modified:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  unchanged: "",
};

const changeTypeIcons: Record<ChangeType, string> = {
  added: "+",
  removed: "-",
  modified: "~",
  unchanged: "",
};

/**
 * Compact inline display for value diffs (used in task details)
 */
export const ValueDiffInline = ({ diff }: { diff: ValueDiff }) => {
  const { key, values, changeType } = diff;
  const showIndicator = changeType !== "unchanged";

  return (
    <div className="grid grid-cols-[auto_1.5rem_1fr] gap-2 items-center py-1">
      {/* Key */}
      <Text size="sm" weight="semibold" className="truncate" title={key}>
        {key}
      </Text>

      {/* Change indicator */}
      <div className="flex justify-center">
        {showIndicator && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-5 h-5 rounded text-xs font-mono",
              changeTypeStyles[changeType],
            )}
          >
            {changeTypeIcons[changeType]}
          </span>
        )}
      </div>

      {/* Values */}
      <InlineStack gap="2" wrap="wrap">
        {values.map((value, index) => {
          const isEmpty = value === undefined || value === "";
          const isFirst = index === 0;
          const showHighlight = changeType !== "unchanged" && !isFirst;

          return (
            <Text
              key={index}
              size="sm"
              className={cn(
                "px-2 py-0.5 rounded border max-w-48 truncate",
                showHighlight && changeTypeStyles[changeType],
                !showHighlight && "bg-muted/30 border-border",
                isEmpty && "text-muted-foreground italic border-dashed",
              )}
              title={value || "(empty)"}
            >
              {isEmpty ? "(empty)" : value}
            </Text>
          );
        })}
      </InlineStack>
    </div>
  );
};
