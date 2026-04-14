import { useNavigate } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { StatusBar, StatusText } from "@/components/shared/Status/";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/router";
import type { PipelineRun, TaskStatusCounts } from "@/types/pipelineRun";
import { formatDate } from "@/utils/date";
import type { ExecutionStatusStats } from "@/utils/executionStatus";

import { PipelineRunStatus } from "./components/PipelineRunStatus";
/**
 * Convert TaskStatusCounts (lowercase keys) to ExecutionStatusStats (uppercase keys)
 * for use with the simplified StatusBar component.
 */
const statusCountsToExecutionStats = (
  counts: TaskStatusCounts | undefined,
): ExecutionStatusStats | undefined => {
  if (!counts) return undefined;

  const stats: ExecutionStatusStats = {};
  if (counts.succeeded > 0) stats.SUCCEEDED = counts.succeeded;
  if (counts.failed > 0) stats.FAILED = counts.failed;
  if (counts.running > 0) stats.RUNNING = counts.running;
  if (counts.pending > 0) stats.PENDING = counts.pending;
  if (counts.waiting > 0) stats.WAITING_FOR_UPSTREAM = counts.waiting;
  if (counts.skipped > 0) stats.SKIPPED = counts.skipped;
  if (counts.cancelled > 0) stats.CANCELLED = counts.cancelled;
  return stats;
};

interface RunOverviewProps {
  run: PipelineRun;
  config?: {
    showStatus?: boolean;
    showName?: boolean;
    showDescription?: boolean;
    showExecutionId?: boolean;
    showCreatedAt?: boolean;
    showTaskStatusBar?: boolean;
    showStatusCounts?: "shorthand" | "full" | "none";
    showAuthor?: boolean;
  };
  className?: string;
  onClick?: (run: PipelineRun) => void;
}

const defaultConfig = {
  showStatus: true,
  showName: true,
  showExecutionId: true,
  showDescription: false,
  showCreatedAt: true,
  showTaskStatusBar: true,
  showStatusCounts: undefined,
  showAuthor: false,
};

const RunOverview = ({
  run,
  config,
  className = "",
  onClick,
}: RunOverviewProps) => {
  const navigate = useNavigate();

  const combinedConfig = {
    ...defaultConfig,
    ...config,
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(run);
    } else {
      const clickThroughUrl = `${APP_ROUTES.RUNS}/${run.id}`;

      if (e.ctrlKey || e.metaKey) {
        window.open(clickThroughUrl, "_blank");
        return;
      }

      navigate({ to: clickThroughUrl });
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex flex-col p-2 text-sm hover:bg-gray-50 cursor-pointer",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0 mb-1">
        {combinedConfig?.showStatus && (
          <span className="shrink-0">
            <PipelineRunStatus run={run} />
          </span>
        )}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {combinedConfig?.showName && (
              <Text size="xs" weight="semibold" className="truncate">
                {run.pipeline_name}
              </Text>
            )}
            {combinedConfig?.showExecutionId &&
              !combinedConfig?.showDescription && (
                <Text size="xs" className="truncate">{`#${run.id}`}</Text>
              )}
            {combinedConfig?.showDescription &&
              !combinedConfig?.showExecutionId && (
                <Text size="xs" className="truncate">
                  {run.pipeline_description || `#${run.id}`}
                </Text>
              )}
            {combinedConfig?.showDescription &&
              combinedConfig?.showExecutionId && (
                <Text size="xs" className="truncate">
                  {run.pipeline_description ?? `#${run.id}`}
                </Text>
              )}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            {combinedConfig?.showCreatedAt && run.created_at && (
              <Text size="xs" className="whitespace-nowrap">
                {formatDate(run.created_at)}
              </Text>
            )}
            {combinedConfig?.showAuthor && run.created_by && (
              <Text size="xs" className="truncate">
                by {run.created_by}
              </Text>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        {combinedConfig?.showStatusCounts &&
          combinedConfig.showStatusCounts !== "none" &&
          run.statusCounts && (
            <StatusText
              statusCounts={run.statusCounts}
              shorthand={
                combinedConfig.showStatusCounts === "shorthand" ||
                (combinedConfig.showAuthor && !!run.created_by)
              }
            />
          )}
      </div>

      {combinedConfig?.showTaskStatusBar && (
        <StatusBar
          executionStatusStats={statusCountsToExecutionStats(run.statusCounts)}
        />
      )}
    </div>
  );
};

export default RunOverview;
