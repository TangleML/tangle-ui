import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent } from "react";

import type { PipelineRunResponse } from "@/api/types.gen";
import { StatusBar, StatusIcon } from "@/components/shared/Status";
import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/router";
import { formatDate } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

const RunRow = ({ run }: { run: PipelineRunResponse }) => {
  const navigate = useNavigate();
  const notify = useToastNotification();

  const runId = `${run.id}`;

  const name = run.pipeline_name ?? "Unknown pipeline";

  const createdBy = run.created_by ?? "Unknown user";
  const truncatedCreatedBy = truncateMiddle(createdBy);
  const isTruncated = createdBy !== truncatedCreatedBy;

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(createdBy);
    notify(`"${createdBy}" copied to clipboard`, "success");
  };

  const overallStatus = getOverallExecutionStatusFromStats(
    run.execution_status_stats ?? undefined,
  );

  const clickThroughUrl = `${APP_ROUTES.RUNS}/${runId}`;

  const handleRowClick = (e: MouseEvent<HTMLElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      window.open(clickThroughUrl, "_blank");
      return;
    }

    navigate({ to: clickThroughUrl });
  };

  const createdByButton = (
    <Button
      className="truncate underline"
      onClick={handleCopy}
      tabIndex={0}
      variant="ghost"
    >
      {truncatedCreatedBy}
    </Button>
  );

  const createdByButtonWithTooltip = (
    <Tooltip>
      <TooltipTrigger asChild>{createdByButton}</TooltipTrigger>
      <TooltipContent>
        <span>{createdBy}</span>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TableRow
      onClick={handleRowClick}
      className="cursor-pointer text-gray-500 text-xs"
    >
      <TableCell>
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <StatusIcon status={overallStatus} />
          <Paragraph className="truncate max-w-100 text-sm" title={name}>
            {name}
          </Paragraph>
          <Paragraph tone="subdued" className="text-sm" title={runId}>
            #{runId}
          </Paragraph>
        </InlineStack>
      </TableCell>
      <TableCell>
        <div className="w-2/3">
          <StatusBar executionStatusStats={run.execution_status_stats} />
        </div>
      </TableCell>
      <TableCell>
        {run.created_at ? formatDate(run.created_at) : "Data not found..."}
      </TableCell>
      <TableCell>
        {isTruncated ? createdByButtonWithTooltip : createdByButton}
      </TableCell>
    </TableRow>
  );
};

export default RunRow;

function truncateMiddle(str: string, maxLength = 28) {
  if (!str || str.length <= maxLength) return str;
  const keep = Math.floor((maxLength - 3) / 2);
  return str.slice(0, keep) + "..." + str.slice(-keep);
}
