import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { PipelineRunInfoCondensed } from "@/components/shared/PipelineRunDisplay/PipelineRunInfoCondensed";
import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { usePipelineRuns } from "@/components/shared/PipelineRunDisplay/usePipelineRuns";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { Paragraph } from "@/components/ui/typography";
import { EDITOR_PATH } from "@/routes/router";
import { deletePipeline } from "@/services/pipelineService";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
import { formatDate } from "@/utils/date";

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

    const handleRowClick = (e: MouseEvent) => {
      // Don't navigate if clicking on the popover trigger
      if ((e.target as HTMLElement).closest("[data-popover-trigger]")) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        window.open(`${EDITOR_PATH}/${name}`, "_blank");
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
          {name && <PipelineRecentRunInfo pipelineName={name} />}
        </TableCell>
        <TableCell>
          {name && <PipelineRunsButton pipelineName={name} />}
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

const PipelineRecentRunInfo = withSuspenseWrapper(
  ({ pipelineName }: { pipelineName: string }) => {
    const { data: pipelineRuns } = usePipelineRuns(pipelineName);

    if (!pipelineRuns || pipelineRuns.length === 0) return null;

    return <PipelineRunInfoCondensed run={pipelineRuns[0]} />;
  },
  () => <Skeleton size="lg" />,
  () => null,
);

const PipelineRunsButton = withSuspenseWrapper(
  ({ pipelineName }: { pipelineName: string }) => {
    const { data: pipelineRuns } = usePipelineRuns(pipelineName);

    if (!pipelineRuns || pipelineRuns.length === 0) return null;

    return (
      <Popover>
        <PopoverTrigger
          data-popover-trigger
          className="cursor-pointer text-gray-500 border border-gray-200 rounded-md p-1 hover:bg-gray-200"
        >
          <Icon name="List" />
        </PopoverTrigger>
        <PopoverContent className="w-125">
          <PipelineRunsList
            pipelineName={pipelineName}
            showMoreButton={false}
            overviewConfig={{
              showName: false,
              showDescription: true,
            }}
          />
        </PopoverContent>
      </Popover>
    );
  },
);

function formatModificationTime(modificationTime: Date | undefined) {
  return modificationTime ? formatDate(modificationTime) : "N/A";
}

export default PipelineRow;
