import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent } from "react";

import type { PipelineRunResponse } from "@/api/types.gen";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { RunSourceIcon } from "@/components/shared/RunSource";
import { StatusBar, StatusIcon } from "@/components/shared/Status";
import { TagList } from "@/components/shared/Tags/TagList";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import {
  getAnnotationValue,
  getPipelineTagsFromAnnotations,
  RUN_SOURCE_ANNOTATION,
} from "@/utils/annotations";
import { formatDate } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";

interface RunRowProps {
  run: PipelineRunResponse;
  onFilterByUser?: (createdBy: string) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelected?: (runId: string) => void;
  onRunClick?: (run: PipelineRunResponse) => void;
}

const RunRow = ({
  run,
  onFilterByUser,
  selectable = false,
  isSelected = false,
  onToggleSelected,
  onRunClick,
}: RunRowProps) => {
  const navigate = useNavigate();
  const { backendUrl } = useBackend();
  const notify = useToastNotification();

  const runId = `${run.id}`;

  const { data: annotations } = useQuery({
    ...runAnnotationsQueryOptions(runId, backendUrl),
  });

  const name = run.pipeline_name ?? "Unknown pipeline";
  const tags = getPipelineTagsFromAnnotations(annotations);
  const source = getAnnotationValue(annotations, RUN_SOURCE_ANNOTATION);

  const createdBy = run.created_by ?? "Unknown user";
  const truncatedCreatedBy = truncateMiddle(createdBy);
  const isTruncated = createdBy !== truncatedCreatedBy;

  const handleFilterByUser = (e: MouseEvent) => {
    e.stopPropagation();
    onFilterByUser?.(createdBy);
  };

  const overallStatus = getOverallExecutionStatusFromStats(
    run.execution_status_stats ?? undefined,
  );

  const clickThroughUrl = getDefaultRunPath(runId);

  const handleRowClick = (e: MouseEvent<HTMLElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) {
      return;
    }

    if (onRunClick) {
      onRunClick(run);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      window.open(clickThroughUrl, "_blank");
      return;
    }

    navigate({ to: clickThroughUrl });
  };

  const handleShare = () => {
    copyToClipboard(new URL(clickThroughUrl, window.location.origin).href);
    notify("Link copied to clipboard", "success");
  };

  const createdByContent = onFilterByUser ? (
    <Button
      className="underline"
      onClick={handleFilterByUser}
      tabIndex={0}
      variant="ghost"
    >
      <Text size="xs" tone="subdued" className="truncate">
        {truncatedCreatedBy}
      </Text>
    </Button>
  ) : (
    <Text size="xs" tone="subdued" className="truncate">
      {truncatedCreatedBy}
    </Text>
  );

  const createdByContentWithTooltip = (
    <Tooltip>
      <TooltipTrigger asChild>{createdByContent}</TooltipTrigger>
      <TooltipContent>
        <span>{createdBy}</span>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TableRow
      onClick={handleRowClick}
      className="cursor-pointer text-muted-foreground text-xs h-10"
    >
      {selectable && (
        <TableCell className="w-8">
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center"
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelected?.(runId)}
              aria-label={`Select run ${runId}`}
            />
          </div>
        </TableCell>
      )}
      <TableCell>
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <StatusIcon status={overallStatus} />
          <span
            className="truncate max-w-100 text-sm text-foreground"
            title={name}
          >
            {name}
          </span>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center text-sm"
          >
            #
            <CopyText size="sm" className="text-muted-foreground">
              {runId}
            </CopyText>
          </div>
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
        {isTruncated ? createdByContentWithTooltip : createdByContent}
      </TableCell>
      <TableCell className="max-w-64">
        {tags && tags.length > 0 && <TagList tags={tags} />}
      </TableCell>
      <TableCell className="w-0">
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <RunSourceIcon source={source} className="opacity-50" />
          <TooltipButton
            tooltip="Share Run"
            onClick={handleShare}
            variant="ghost"
            size="icon"
            className="w-fit h-fit p-1 text-muted-foreground hover:text-foreground"
            {...tracking("run_home.table.share_run")}
          >
            <Icon name="Share2" />
          </TooltipButton>
          <FavoriteToggle type="run" id={runId} name={name} />
        </InlineStack>
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
