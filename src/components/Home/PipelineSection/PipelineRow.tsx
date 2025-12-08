import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import RunOverview from "@/components/shared/RunOverview";
import StatusIcon from "@/components/shared/Status/StatusIcon";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { Heading, Paragraph } from "@/components/ui/typography";
import useLoadPipelineRuns from "@/hooks/useLoadPipelineRuns";
import { useBackend } from "@/providers/BackendProvider";
import { EDITOR_PATH } from "@/routes/router";
import { deletePipeline } from "@/services/pipelineService";
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

const PipelineRow = ({
  name,
  modificationTime,
  onDelete,
  isSelected = false,
  onSelect,
}: PipelineRowProps) => {
  const { backendUrl } = useBackend();
  const navigate = useNavigate();

  const { pipelineRuns, latestRun } = useLoadPipelineRuns(
    name || "",
    backendUrl,
  );

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

  const formattedDate = modificationTime
    ? formatDate(modificationTime.toISOString())
    : "N/A";

  return (
    <>
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
          {!!latestRun && (
            <InlineStack gap="2" blockAlign="center">
              <StatusIcon status={latestRun.status} />
              <Paragraph tone="subdued" size="xs">
                {formatDate(
                  convertUTCToLocalTime(latestRun.created_at).toISOString(),
                )}
              </Paragraph>
            </InlineStack>
          )}
        </TableCell>
        <TableCell>
          {pipelineRuns.length > 0 && (
            <Popover>
              <PopoverTrigger
                data-popover-trigger
                className="cursor-pointer text-gray-500 border border-gray-200 rounded-md p-1 hover:bg-gray-200"
              >
                <Icon name="List" />
              </PopoverTrigger>
              <PopoverContent className="w-[500px]">
                <InlineStack gap="2" blockAlign="center" className="mb-4">
                  <Heading level={2}>{pipelineRuns[0].pipeline_name}</Heading>
                  <Paragraph size="sm">- {pipelineRuns.length} runs</Paragraph>
                </InlineStack>
                <ScrollArea className="h-[300px]">
                  {pipelineRuns.map((run) => (
                    <RunOverview key={run.id} run={run} />
                  ))}
                </ScrollArea>
              </PopoverContent>
            </Popover>
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
    </>
  );
};

export default PipelineRow;
