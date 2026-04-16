import { useNavigate } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { type MouseEvent, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import { Paragraph } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { useFolderNavigation } from "@/routes/v2/pages/PipelineFolders/context/FolderNavigationContext";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import { formatDate } from "@/utils/date";

import { FolderRowMenu } from "./FolderRowMenu";
import { handleDragStart, useFolderDragDrop } from "./useFolderDragDrop";

const folderRowVariants = cva("cursor-pointer hover:bg-muted/50 group", {
  variants: {
    isDragOver: { true: "", false: "" },
    canAcceptDrop: { true: "", false: "" },
    isDragging: { true: "opacity-50", false: "" },
  },
  compoundVariants: [
    {
      isDragOver: true,
      canAcceptDrop: true,
      className: "bg-primary/10 ring-1 ring-primary",
    },
    {
      isDragOver: true,
      canAcceptDrop: false,
      className: "opacity-50 cursor-not-allowed",
    },
  ],
  defaultVariants: {
    isDragOver: false,
    canAcceptDrop: true,
    isDragging: false,
  },
});

interface FolderRowProps {
  folder: PipelineFolder;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
  onItemDrop?: (data: string) => void;
  canAcceptDrop?: boolean;
  dragData?: string;
  isDragging?: boolean;
  dragItemCount?: number;
  onDragStateChange?: (isDragging: boolean) => void;
  icon?: ReactNode;
  extraMenuItems?: ReactNode;
  hideDefaultMenuItems?: boolean;
}

export function FolderRow({
  folder,
  isSelected = false,
  onSelect,
  onItemDrop,
  canAcceptDrop = true,
  dragData,
  isDragging,
  dragItemCount,
  onDragStateChange,
  icon,
  extraMenuItems,
  hideDefaultMenuItems = false,
}: FolderRowProps) {
  const navigate = useNavigate();
  const folderNav = useFolderNavigation();

  const {
    isDragOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
  } = useFolderDragDrop(canAcceptDrop, onItemDrop);

  const handleRowClick = (e: MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        "[data-checkbox], [data-dropdown-trigger]",
      )
    ) {
      return;
    }
    if (folderNav) {
      folderNav.navigateToFolder(folder.id);
    } else {
      navigate({
        to: APP_ROUTES.PIPELINE_FOLDERS,
        search: { folderId: folder.id },
      });
    }
  };

  const formattedDate = folder.createdAt
    ? formatDate(new Date(folder.createdAt))
    : "N/A";

  return (
    <TableRow
      className={folderRowVariants({ isDragOver, canAcceptDrop, isDragging })}
      onClick={handleRowClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          data-checkbox
          checked={isSelected}
          onCheckedChange={(checked: boolean) => onSelect?.(checked)}
          onClick={(e: MouseEvent) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell>
        <div
          draggable={!!dragData}
          onDragStart={(e) =>
            handleDragStart(e, dragData, dragItemCount, onDragStateChange)
          }
          onDragEnd={() => onDragStateChange?.(false)}
          className={dragData ? "cursor-grab" : undefined}
        >
          <InlineStack gap="2" blockAlign="center">
            {icon ?? (
              <Icon
                name="Folder"
                fill="currentColor"
                size="lg"
                className="text-muted-foreground shrink-0"
              />
            )}
            <Paragraph weight="semibold">{folder.name}</Paragraph>
          </InlineStack>
        </div>
      </TableCell>
      <TableCell>
        <Paragraph tone="subdued" size="xs">
          {formattedDate}
        </Paragraph>
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell className="w-0">
        <FolderRowMenu
          folder={folder}
          hideDefaultMenuItems={hideDefaultMenuItems}
          extraMenuItems={extraMenuItems}
        />
      </TableCell>
    </TableRow>
  );
}
