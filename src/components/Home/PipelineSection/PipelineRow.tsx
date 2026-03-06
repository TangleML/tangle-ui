import { useNavigate } from "@tanstack/react-router";
import { type DragEvent, type MouseEvent, type ReactNode } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { HighlightText } from "@/components/shared/HighlightText";
import { PipelineRunInfoCondensed } from "@/components/shared/PipelineRunDisplay/PipelineRunInfoCondensed";
import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { usePipelineRuns } from "@/components/shared/PipelineRunDisplay/usePipelineRuns";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { TagList } from "@/components/shared/Tags/TagList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { EDITOR_PATH } from "@/routes/router";
import { deletePipeline } from "@/services/pipelineService";
import { getPipelineTagsFromSpec } from "@/utils/annotations";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
import { formatDate } from "@/utils/date";

import type { MatchedField } from "./usePipelineFilters";

const MAX_TITLE_LENGTH = 80;

interface PipelineRowProps {
  url?: string;
  componentRef?: ComponentReferenceWithSpec;
  name?: string;
  modificationTime?: Date;
  onDelete?: () => void;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
  searchQuery?: string;
  matchedFields?: MatchedField[];
  componentQuery?: string;
  matchedComponentNames?: string[];
  onPipelineClick?: (name: string) => void;
  icon?: ReactNode;
  dragData?: string;
  isDragging?: boolean;
  dragItemCount?: number;
  onDragStateChange?: (isDragging: boolean) => void;
}

const PipelineRow = withSuspenseWrapper(
  ({
    name,
    componentRef,
    modificationTime,
    onDelete,
    isSelected = false,
    onSelect,
    searchQuery,
    matchedFields,
    componentQuery,
    matchedComponentNames,
    onPipelineClick,
    icon,
    dragData,
    isDragging,
    dragItemCount,
    onDragStateChange,
  }: PipelineRowProps) => {
    const navigate = useNavigate();

    const componentSpec = componentRef?.spec;

    const tags = getPipelineTagsFromSpec(componentSpec);

    const handleRowClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-popover-trigger]")) {
        return;
      }

      if (onPipelineClick && name) {
        onPipelineClick(name);
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
        className={cn(
          "cursor-pointer hover:bg-muted/50 group text-xs h-10",
          isDragging && "opacity-50",
        )}
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
          <div
            draggable={!!dragData}
            onDragStart={(e: DragEvent<HTMLDivElement>) => {
              if (!dragData) return;
              e.dataTransfer.setData("application/x-folder-move", dragData);
              e.dataTransfer.effectAllowed = "move";
              if (dragItemCount && dragItemCount > 1) {
                const ghost = document.createElement("div");
                ghost.style.cssText =
                  "position:fixed;top:-1000px;left:-1000px;padding:6px 12px;border-radius:6px;font-size:14px;font-weight:500;color:white;background:#0f172a;box-shadow:0 4px 12px rgba(0,0,0,0.15);white-space:nowrap;";
                ghost.textContent = `${dragItemCount} items`;
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 0, 0);
                requestAnimationFrame(() => ghost.remove());
              }
              onDragStateChange?.(true);
            }}
            onDragEnd={() => onDragStateChange?.(false)}
            className={dragData ? "cursor-grab" : undefined}
          >
            <InlineStack gap="1" blockAlign="center">
              {name && name.length > MAX_TITLE_LENGTH ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm truncate">
                        <HighlightText
                          text={name.slice(0, MAX_TITLE_LENGTH) + "..."}
                          query={searchQuery}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-sm truncate">
                  <HighlightText text={name ?? ""} query={searchQuery} />
                </span>
              )}
              <MatchBadges
                matchedFields={matchedFields}
                matchedComponentNames={matchedComponentNames}
                searchQuery={searchQuery}
                componentQuery={componentQuery}
              />
            </InlineStack>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </TableCell>
        <TableCell className="max-w-64">
          {tags && tags.length > 0 && <TagList tags={tags} />}
        </TableCell>
        <TableCell>
          {name && <PipelineRecentRunInfo pipelineName={name} />}
        </TableCell>
        <TableCell>
          {name && <PipelineRunsButton pipelineName={name} />}
        </TableCell>
        <TableCell className="w-16">
          <InlineStack gap="1" blockAlign="center" wrap="nowrap">
            {name && <FavoriteToggle type="pipeline" id={name} name={name} />}
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
          </InlineStack>
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
          <InlineStack gap="2" blockAlign="center">
            <Paragraph>{props.name}</Paragraph>
          </InlineStack>
        </TableCell>
        <TableCell>
          <Paragraph tone="subdued" size="sm">
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

function MatchBadges({
  matchedFields,
  matchedComponentNames,
  searchQuery,
  componentQuery,
}: {
  matchedFields?: MatchedField[];
  matchedComponentNames?: string[];
  searchQuery?: string;
  componentQuery?: string;
}) {
  const hasFields = matchedFields && matchedFields.length > 0;
  const hasComponents =
    matchedComponentNames && matchedComponentNames.length > 0;

  if (!hasFields && !hasComponents) return null;

  return (
    <InlineStack gap="1" className="mt-1" wrap="wrap">
      {matchedFields?.map((field) => (
        <Badge
          key={field.label}
          variant="secondary"
          size="sm"
          className="max-w-60 truncate"
        >
          {field.label}:{" "}
          <HighlightText text={field.value} query={searchQuery} />
        </Badge>
      ))}
      {matchedComponentNames?.map((compName) => (
        <Badge key={compName} variant="secondary" size="sm">
          <Icon name="File" size="xs" />
          <HighlightText text={compName} query={componentQuery} />
        </Badge>
      ))}
    </InlineStack>
  );
}

function formatModificationTime(modificationTime: Date | undefined) {
  return modificationTime ? formatDate(modificationTime) : "N/A";
}

export default PipelineRow;
