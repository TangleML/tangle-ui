import { useNavigate } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { type DragEvent, type MouseEvent } from "react";

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
import { Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { deletePipeline } from "@/services/pipelineService";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { getPipelineTagsFromSpec } from "@/utils/annotations";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
import { formatDate } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { SavePipelineToCloudButton } from "./SavePipelineToCloudButton";
import type { MatchedField } from "./usePipelineFilters";

const MAX_TITLE_LENGTH = 80;

/** Default `analyticsTrackingPrefix` for the home pipeline list (non-`v2.*` warehouse slice). */
const DEFAULT_PIPELINE_ROW_ANALYTICS_PREFIX = "pipeline_home.table";

interface PipelineRowProps {
  file?: PipelineFile;
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
  dragData?: string;
  isDragging?: boolean;
  dragItemCount?: number;
  onDragStateChange?: (isDragging: boolean) => void;
  analyticsTrackingPrefix?: string;
}

const PipelineRow = withSuspenseWrapper(
  observer(
    ({
      file,
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
      dragData,
      isDragging,
      dragItemCount,
      onDragStateChange,
      analyticsTrackingPrefix = DEFAULT_PIPELINE_ROW_ANALYTICS_PREFIX,
    }: PipelineRowProps) => {
      const navigate = useNavigate();
      const { track } = useAnalytics();
      const notify = useToastNotification();
      const referenceId = file?.referenceId ?? name;

      const rowTrack = (suffix: string, metadata?: Record<string, unknown>) => {
        track(`${analyticsTrackingPrefix}.${suffix}`, metadata);
      };

      const componentSpec = componentRef?.spec;

      const tags = getPipelineTagsFromSpec(componentSpec);

      const handleRowClick = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest("[data-popover-trigger]")) {
          return;
        }

        if (onPipelineClick && referenceId) {
          rowTrack("pipeline_opened", { open_mode: "embedded" });
          onPipelineClick(referenceId);
          return;
        }

        if (!referenceId) return;

        if (e.ctrlKey || e.metaKey) {
          rowTrack("pipeline_opened", { open_mode: "editor_new_tab" });
          window.open(getDefaultEditorPath(referenceId), "_blank");
          return;
        }
        rowTrack("pipeline_opened", { open_mode: "editor_same_tab" });
        navigate({ to: getDefaultEditorPath(referenceId) });
      };

      const handleCheckboxChange = (checked: boolean | "indeterminate") => {
        if (checked === "indeterminate") return;
        rowTrack("pipeline_selection_toggled", { new_value: checked });
        onSelect?.(checked);
      };

      const confirmPipelineDelete = async () => {
        if (!name) return;

        if (file) {
          try {
            await file.deleteFile();
            onDelete?.();
          } catch (error) {
            notify(
              `Could not delete pipeline: ${error instanceof Error ? error.message : String(error)}`,
              "error",
            );
          }
          return;
        }

        const deleteCallback = () => {
          onDelete?.();
        };

        await deletePipeline(name, deleteCallback);
      };

      const handleClick = (e: MouseEvent) => {
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
              disabled={file?.canEdit === false}
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
            >
              <InlineStack
                gap="2"
                blockAlign="start"
                className="w-full truncate"
                wrap="nowrap"
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
                  {file?.storageKind === "local" &&
                    ["root-indexdb", "folder-indexdb"].includes(
                      file.folder.driver.type,
                    ) && (
                      <Badge
                        variant="outline"
                        size="sm"
                        className="font-normal text-muted-foreground"
                      >
                        Local
                      </Badge>
                    )}
                  {file?.storageKind === "pending" && (
                    <Badge
                      variant="outline"
                      size="sm"
                      className="font-normal text-muted-foreground"
                    >
                      Pending upload
                    </Badge>
                  )}
                  {file?.saveError && (
                    <span className="text-destructive text-xs">
                      Not saved to server
                    </span>
                  )}
                </InlineStack>
              </InlineStack>
            </div>
          </TableCell>
          <TableCell>
            <Text size="xs" tone="subdued">
              {formattedDate}
            </Text>
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
          <TableCell className="w-px">
            <div className="grid w-max grid-cols-3 gap-1">
              <div className="flex size-9 items-center justify-center">
                {file && <SavePipelineToCloudButton file={file} />}
              </div>
              <div className="flex size-9 items-center justify-center">
                {referenceId && name && (
                  <FavoriteToggle
                    type="pipeline"
                    id={referenceId}
                    name={name}
                  />
                )}
              </div>
              <div className="flex size-9 items-center justify-center">
                {file?.canEdit !== false && (
                  <ConfirmationDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete pipeline: ${name}`}
                        className="text-muted-foreground hover:text-destructive-foreground"
                        {...tracking(
                          `${analyticsTrackingPrefix}.pipeline_delete_confirm_open`,
                        )}
                      >
                        <Icon name="Trash" />
                      </Button>
                    }
                    title={`Delete pipeline "${name}"?`}
                    description="Are you sure you want to delete this pipeline? Existing pipeline runs will not be impacted. This action cannot be undone."
                    onConfirm={confirmPipelineDelete}
                  />
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      );
    },
  ),
  (props) => {
    const formattedDate = formatModificationTime(props.modificationTime);

    return (
      <TableRow>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Skeleton size="sm" />
        </TableCell>
        <TableCell>
          <InlineStack gap="2" blockAlign="center">
            <Paragraph size="sm">{props.name}</Paragraph>
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
          className="cursor-pointer text-muted-foreground border border-border rounded-md p-1 hover:bg-accent"
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
