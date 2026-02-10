import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent } from "react";

import type { ListPipelineJobsResponse } from "@/api/types.gen";
import { StatusBar, StatusIcon } from "@/components/shared/Status";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/router";
import { convertUTCToLocalTime, formatDate } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

type PipelineRunItem = ListPipelineJobsResponse["pipeline_runs"][number];

const RUN_CELL_BASE =
  "py-2.5 align-middle bg-transparent transition-all duration-300 ease-out group-hover:bg-violet-500/6";
const RUN_CELL_SHADOW =
  "group-hover:shadow-[0_14px_28px_-18px_rgba(124,58,237,0.32)]";

function truncateMiddle(str: string, maxLength = 28) {
  if (!str || str.length <= maxLength) return str;
  const keep = Math.floor((maxLength - 3) / 2);
  return str.slice(0, keep) + "..." + str.slice(-keep);
}

const CreatedByCell = ({ createdBy }: { createdBy: string }) => {
  const notify = useToastNotification();
  const truncated = truncateMiddle(createdBy);
  const isTruncated = createdBy !== truncated;

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(createdBy);
    notify(`"${createdBy}" copied to clipboard`, "success");
  };

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto px-1 py-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
      onClick={handleCopy}
    >
      {truncated}
    </Button>
  );

  if (!isTruncated) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        <Text as="span" size="xs">
          {createdBy}
        </Text>
      </TooltipContent>
    </Tooltip>
  );
};

export const RunsTable = ({
  runs,
  showPinControls = false,
  pinnedRunUrls,
  onToggleRunPinned,
}: {
  runs: PipelineRunItem[];
  showPinControls?: boolean;
  pinnedRunUrls?: Set<string>;
  onToggleRunPinned?: (run: PipelineRunItem) => void;
}) => {
  const navigate = useNavigate();

  return (
    <table className="w-full table-fixed border-collapse">
      {/* Inline styles are necessary here: Tailwind doesn't support width on
          <col> elements, and colgroup is the most reliable cross-browser way
          to set fixed column widths on a table-fixed layout. */}
      <colgroup>
        <col style={{ width: 28 }} />
        <col />
        <col style={{ width: "30%" }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 160 }} />
        {showPinControls && <col style={{ width: 46 }} />}
      </colgroup>
      <thead>
        <tr className="border-b border-border/30 text-left">
          <th className="py-2 pl-3 pr-1" />
          <th className="px-2 py-2">
            <Text as="span" size="xs" tone="subdued">
              Name
            </Text>
          </th>
          <th className="px-2 py-2">
            <Text as="span" size="xs" tone="subdued">
              Status
            </Text>
          </th>
          <th className="px-2 py-2">
            <Text as="span" size="xs" tone="subdued">
              Date
            </Text>
          </th>
          <th className="px-2 py-2 pr-3">
            <Text as="span" size="xs" tone="subdued">
              Initiated By
            </Text>
          </th>
          {showPinControls && <th className="py-2 pl-1 pr-3" />}
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => {
          const overallStatus = getOverallExecutionStatusFromStats(
            run.execution_status_stats ?? undefined,
          );
          const createdAt = run.created_at
            ? formatDate(convertUTCToLocalTime(run.created_at).toISOString())
            : null;
          const createdBy = run.created_by ?? "Unknown";
          const totalTasks = run.execution_status_stats
            ? Object.values(run.execution_status_stats).reduce(
                (sum, c) => sum + (c ?? 0),
                0,
              )
            : 0;

          const clickUrl = `${APP_ROUTES.RUNS}/${run.id}`;
          const isPinned = pinnedRunUrls?.has(clickUrl) ?? false;

          const handleRowClick = (e: MouseEvent<HTMLElement>) => {
            if (e.target instanceof HTMLElement && e.target.closest("button")) {
              return;
            }

            if (e.ctrlKey || e.metaKey) {
              window.open(clickUrl, "_blank");
              return;
            }
            navigate({ to: clickUrl });
          };

          return (
            <tr
              key={run.id}
              onClick={handleRowClick}
              className="group cursor-pointer border-b border-border/20 last:border-b-0"
            >
              <td
                className={cn(
                  RUN_CELL_BASE,
                  RUN_CELL_SHADOW,
                  "rounded-l-xl pl-3 pr-1",
                )}
              >
                <StatusIcon status={overallStatus} />
              </td>
              <td className={cn(RUN_CELL_BASE, "overflow-hidden px-2")}>
                <Text as="p" size="sm" weight="semibold" className="truncate">
                  {run.pipeline_name ?? "Unknown pipeline"}
                </Text>
                <Text
                  as="p"
                  size="xs"
                  tone="subdued"
                  font="mono"
                  className="truncate leading-tight"
                >
                  #{String(run.id).slice(0, 14)}
                  {totalTasks > 0 && (
                    <Text as="span" size="xs" tone="subdued" font="default">
                      {" "}
                      &middot; {totalTasks} tasks
                    </Text>
                  )}
                </Text>
              </td>
              <td className={cn(RUN_CELL_BASE, "px-2")}>
                <StatusBar executionStatusStats={run.execution_status_stats} />
              </td>
              <td className={cn(RUN_CELL_BASE, "whitespace-nowrap px-2")}>
                <Text as="span" size="xs" tone="subdued">
                  {createdAt ?? "—"}
                </Text>
              </td>
              <td
                className={cn(
                  RUN_CELL_BASE,
                  RUN_CELL_SHADOW,
                  "overflow-hidden rounded-r-xl px-2 pr-3",
                )}
              >
                <CreatedByCell createdBy={createdBy} />
              </td>
              {showPinControls && onToggleRunPinned && (
                <td className={cn(RUN_CELL_BASE, RUN_CELL_SHADOW, "pl-1 pr-3")}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
                      isPinned && "text-violet-500",
                    )}
                    aria-label={isPinned ? "Unpin run" : "Pin run"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleRunPinned(run);
                    }}
                  >
                    <Icon name={isPinned ? "Pin" : "PinOff"} size="sm" />
                  </Button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
