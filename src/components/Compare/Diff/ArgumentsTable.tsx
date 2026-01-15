import type { PropsWithChildren } from "react";

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

interface ArgumentsTableProps extends PropsWithChildren {
  runLabels: string[];
  compact?: boolean;
}

/**
 * Table container for arguments comparison with proper column alignment
 */
export const ArgumentsTable = ({
  runLabels,
  compact = false,
  children,
}: ArgumentsTableProps) => {
  const columnCount = runLabels.length;

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="grid gap-2 min-w-fit"
        style={{
          gridTemplateColumns: `auto 1.5rem repeat(${columnCount}, minmax(150px, 1fr))`,
        }}
      >
        {/* Header row */}
        {!compact && (
          <>
            <div className="py-2 px-1">
              <Text size="sm" weight="semibold" tone="subdued">
                Argument
              </Text>
            </div>
            <div /> {/* Spacer for change indicator */}
            {runLabels.map((label) => (
              <div key={label} className="py-2 px-2">
                <Text
                  size="sm"
                  weight="semibold"
                  tone="subdued"
                  className="truncate block"
                  title={label}
                >
                  {label}
                </Text>
              </div>
            ))}
          </>
        )}

        {children}
      </div>
    </div>
  );
};

interface ArgumentRowProps {
  diff: ValueDiff;
  compact?: boolean;
}

/**
 * Single row in the arguments table
 */
export const ArgumentRow = ({ diff, compact = false }: ArgumentRowProps) => {
  const { key, values, changeType } = diff;
  const showChangeIndicator = changeType !== "unchanged";

  return (
    <>
      {/* Key column */}
      <div
        className={cn(
          "py-2 px-1 flex items-start",
          compact ? "min-h-8" : "min-h-10",
        )}
      >
        <Text
          size="sm"
          weight="semibold"
          className="truncate"
          title={key}
        >
          {key}
        </Text>
      </div>

      {/* Change indicator column */}
      <div className="py-2 flex items-start justify-center">
        {showChangeIndicator && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-5 h-5 rounded text-xs font-mono shrink-0",
              changeTypeStyles[changeType],
            )}
          >
            {changeTypeIcons[changeType]}
          </span>
        )}
      </div>

      {/* Value columns */}
      {values.map((value, index) => {
        const isEmpty = value === undefined || value === "";
        const isFirst = index === 0;
        const showHighlight = changeType !== "unchanged" && !isFirst;

        return (
          <div
            key={index}
            className={cn(
              "py-2 px-2 rounded border",
              compact ? "min-h-8" : "min-h-10",
              showHighlight && changeTypeStyles[changeType],
              isEmpty && "bg-muted/50",
              !showHighlight && !isEmpty && "border-border bg-muted/20",
              isEmpty && "border-dashed",
            )}
          >
            <Text
              size="sm"
              className={cn(
                "break-words",
                isEmpty && "text-muted-foreground italic",
              )}
            >
              {isEmpty ? "(empty)" : value}
            </Text>
          </div>
        );
      })}
    </>
  );
};

