import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import RunOverview from "@/components/shared/RunOverview";
import StatusIcon from "@/components/shared/Status/StatusIcon";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { Heading, Paragraph } from "@/components/ui/typography";
import { EDITOR_PATH } from "@/routes/router";
import { fetchExecutionStatusLight } from "@/services/executionService";
import { fetchPipelineRuns } from "@/services/pipelineRunService";
import { deletePipeline } from "@/services/pipelineService";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
import { convertUTCToLocalTime, formatDate } from "@/utils/date";

interface PipelineRowProps {
  url?: string;
  componentRef?: ComponentReferenceWithSpec;
  name?: string;
  modificationTime?: Date;
  onDelete?: () => void;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
}

const PipelineRow = withSuspenseWrapper(
  ({
    name,
    modificationTime,
    onDelete,
    isSelected = false,
    onSelect,
  }: PipelineRowProps) => {
    const navigate = useNavigate();

    const { data: pipelineRuns } = useSuspenseQuery({
      queryKey: ["pipelineRuns", name],
      queryFn: async () => {
        if (!name) return [];

        const res = await fetchPipelineRuns(name);

        if (!res) return [];

        return res.runs;
      },
    });

    const handleRowClick = (e: MouseEvent) => {
      // Don't navigate if clicking on the popover trigger
      if ((e.target as HTMLElement).closest("[data-popover-trigger]")) {
        return;
      }
      navigate({ to: `${EDITOR_PATH}/${name}` });
    };

    const handleCheckboxChange = (checked: boolean) => {
      onSelect?.(checked);
    };

    const confirmPipelineDelete = async () => {
      if (!name) return;

      const deleteCallback = () => {
        onDelete?.();
      };

      await deletePipeline(name, deleteCallback);
    };

    const handleClick = (e: MouseEvent) => {
      // Prevent row click when clicking on the checkbox
      e.stopPropagation();
    };

    const formattedDate = formatModificationTime(modificationTime);

    return (
      <TableRow
        className="cursor-pointer hover:bg-muted/50 group"
        onClick={handleRowClick}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            data-checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            onClick={handleClick}
          />
        </TableCell>
        <TableCell>
          <Paragraph>{name}</Paragraph>
        </TableCell>
        <TableCell>
          <Paragraph tone="subdued" size="xs">
            {formattedDate}
          </Paragraph>
        </TableCell>
        <TableCell>
          {pipelineRuns.length > 0 && <RecentRunInfo run={pipelineRuns[0]} />}
        </TableCell>
        <TableCell>
          {name && (
            <PipelineRunsButton
              pipelineRuns={pipelineRuns}
              pipelineName={name}
            />
          )}
        </TableCell>
        <TableCell className="w-0">
          <ConfirmationDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 cursor-pointer text-destructive-foreground hover:text-destructive-foreground"
              >
                <Icon name="Trash" />
              </Button>
            }
            title={`Delete pipeline "${name}"?`}
            description="Are you sure you want to delete this pipeline? Existing pipeline runs will not be impacted. This action cannot be undone."
            onConfirm={confirmPipelineDelete}
          />
        </TableCell>
      </TableRow>
    );
  },
  (props) => {
    const formattedDate = formatModificationTime(props.modificationTime);

    return (
      <TableRow>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Skeleton size="sm" />
        </TableCell>
        <TableCell>
          <Paragraph>{props.name}</Paragraph>
        </TableCell>
        <TableCell>
          <Paragraph tone="subdued" size="xs">
            {formattedDate}
          </Paragraph>
        </TableCell>
        <TableCell>
          <Skeleton size="lg" />
        </TableCell>
        <TableCell>
          <Skeleton size="lg" />
        </TableCell>
        <TableCell className="w-0">
          <Skeleton size="lg" />
        </TableCell>
      </TableRow>
    );
  },
);

const RecentRunInfo = withSuspenseWrapper(
  ({ run }: { run: PipelineRun }) => {
    const { data: runStatus } = useSuspenseQuery({
      queryKey: ["runStatus", run.root_execution_id],
      queryFn: async () => {
        return await fetchExecutionStatusLight(
          run.root_execution_id.toString(),
        );
      },
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

    return (
      <InlineStack gap="2">
        <StatusIcon status={runStatus} />
        <Paragraph tone="subdued" size="xs">
          {formatDate(convertUTCToLocalTime(run.created_at).toISOString())}
        </Paragraph>
      </InlineStack>
    );
  },
  () => {
    return (
      <InlineStack gap="2">
        <Skeleton size="sm" />
      </InlineStack>
    );
  },
);

const PipelineRunsList = withSuspenseWrapper(
  ({
    pipelineName,
    pipelineRuns,
  }: {
    pipelineName: string;
    pipelineRuns: PipelineRun[];
  }) => {
    if (pipelineRuns.length === 0) {
      return (
        <InlineStack gap="2" className="mb-4">
          <Heading level={2}>{pipelineName}</Heading>
          <Paragraph size="sm">- 0 runs</Paragraph>
        </InlineStack>
      );
    }

    return (
      <>
        <InlineStack gap="2" className="mb-4">
          <Heading level={2}>{pipelineName}</Heading>
          <Paragraph size="sm">- {pipelineRuns.length} runs</Paragraph>
        </InlineStack>
        <ScrollArea className="h-[300px]">
          {pipelineRuns.map((run) => (
            <RunOverview key={run.id} run={run} />
          ))}
        </ScrollArea>
      </>
    );
  },
);

const PipelineRunsButton = withSuspenseWrapper(
  ({
    pipelineName,
    pipelineRuns,
  }: {
    pipelineName: string;
    pipelineRuns: PipelineRun[] | null | undefined;
  }) => {
    if (!pipelineRuns || pipelineRuns.length === 0) return null;

    return (
      <Popover>
        <PopoverTrigger
          data-popover-trigger
          className="cursor-pointer text-gray-500 border border-gray-200 rounded-md p-1 hover:bg-gray-200"
        >
          <Icon name="List" />
        </PopoverTrigger>
        <PopoverContent className="w-[500px]">
          <PipelineRunsList
            pipelineName={pipelineName}
            pipelineRuns={pipelineRuns}
          />
        </PopoverContent>
      </Popover>
    );
  },
);

function formatModificationTime(modificationTime: Date | undefined) {
  return modificationTime ? formatDate(modificationTime.toISOString()) : "N/A";
}

export default PipelineRow;
