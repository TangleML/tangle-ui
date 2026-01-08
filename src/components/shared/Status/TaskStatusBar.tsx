import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TaskStatusInfo } from "@/utils/collectTaskStatuses";
import {
  EXECUTION_STATUS_BG_COLORS,
  type ExecutionStatusStats,
  getExecutionStatusLabel,
} from "@/utils/executionStatus";

import { TaskStatusList } from "./TaskStatusList";

const STATUS_DISPLAY_ORDER = [
  "SUCCEEDED",
  "RUNNING",
  "PENDING",
  "UNINITIALIZED",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "CANCELLING",
  "CANCELLED",
  "FAILED",
  "INVALID",
  "SYSTEM_ERROR",
  "SKIPPED",
] as const;

const HATCHED_SEGMENT_CLASS =
  "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(0,0,0,0.5)_6px,rgba(0,0,0,0.5)_12px)] bg-blend-multiply bg-repeat bg-[length:512px_24px] bg-[position:left_top]";

const BAR_CLASS = "h-2 w-full rounded overflow-hidden bg-gray-200";

interface StatusSegmentProps {
  status: string;
  count: number;
  total: number;
}

const StatusSegment = ({ status, count, total }: StatusSegmentProps) => {
  const label = getExecutionStatusLabel(status);
  const colorClass = EXECUTION_STATUS_BG_COLORS[status] ?? "bg-slate-300";
  const width = `${(count / total) * 100}%`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(colorClass, "h-full")}
          style={{ width }}
          aria-label={`${count} ${label}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {count} {label}
      </TooltipContent>
    </Tooltip>
  );
};

interface TaskStatusBarProps {
  executionStatusStats?: ExecutionStatusStats | null;
  taskStatuses?: TaskStatusInfo[];
  viewAllLabel?: string;
  rootExecutionId?: string;
}

const TaskStatusBar = ({
  executionStatusStats,
  taskStatuses,
  viewAllLabel = "View all",
  rootExecutionId,
}: TaskStatusBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!executionStatusStats) {
    return <InlineStack wrap="nowrap" gap="0" className={BAR_CLASS} />;
  }

  const entries = Object.entries(executionStatusStats).filter(
    ([, count]) => (count ?? 0) > 0,
  );

  if (entries.length === 0) {
    return <InlineStack wrap="nowrap" gap="0" className={BAR_CLASS} />;
  }

  const total = entries.reduce((sum, [, count]) => sum + (count ?? 0), 0);

  const hasCancelled =
    (executionStatusStats.CANCELLED ?? 0) > 0 ||
    (executionStatusStats.CANCELLING ?? 0) > 0;

  const orderMap = new Map<string, number>(
    STATUS_DISPLAY_ORDER.map((s, i) => [s, i]),
  );
  const sortedEntries = entries.sort(([a], [b]) => {
    const aOrder = orderMap.get(a) ?? STATUS_DISPLAY_ORDER.length;
    const bOrder = orderMap.get(b) ?? STATUS_DISPLAY_ORDER.length;
    return aOrder - bOrder;
  });

  const showViewAll = taskStatuses && taskStatuses.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <BlockStack gap="1">
        <BlockStack className="relative">
          <InlineStack wrap="nowrap" gap="0" className={BAR_CLASS}>
            {sortedEntries.map(([status, count]) => (
              <StatusSegment
                key={status}
                status={status}
                count={count ?? 0}
                total={total}
              />
            ))}
          </InlineStack>
          {hasCancelled && (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 rounded",
                HATCHED_SEGMENT_CLASS,
              )}
            />
          )}
        </BlockStack>
        {showViewAll && (
          <CollapsibleTrigger asChild>
            <InlineStack align="end">
              <Button
                variant="link"
                size="inline-xs"
                className="text-muted-foreground hover:text-foreground"
              >
                <InlineStack gap="1" blockAlign="center">
                  {isExpanded ? "Hide" : viewAllLabel}
                  <Icon
                    name="ChevronDown"
                    size="xs"
                    className={cn(
                      "transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  />
                </InlineStack>
              </Button>
            </InlineStack>
          </CollapsibleTrigger>
        )}
      </BlockStack>
      {showViewAll && (
        <CollapsibleContent>
          <BlockStack className="mt-1 max-h-64 overflow-y-auto">
            <TaskStatusList
              tasks={taskStatuses}
              rootExecutionId={rootExecutionId}
            />
          </BlockStack>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export default TaskStatusBar;
