import { useNavigate } from "@tanstack/react-router";
import { type DragEvent, type MouseEvent, useRef, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/router";
import { formatDate } from "@/utils/date";

import {
  useDeleteFolder,
  useRenameFolder,
  useToggleFavorite,
} from "../hooks/useFolderMutations";
import type { PipelineFolder } from "../types";
import { RenameFolderDialog } from "./RenameFolderDialog";

const DRAG_MIME = "application/x-folder-move";

interface FolderRowProps {
  folder: PipelineFolder;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
  onItemDrop?: (data: string) => void;
  dragData?: string;
  isDragging?: boolean;
  dragItemCount?: number;
  onDragStateChange?: (isDragging: boolean) => void;
}

export function FolderRow({
  folder,
  isSelected = false,
  onSelect,
  onItemDrop,
  dragData,
  isDragging,
  dragItemCount,
  onDragStateChange,
}: FolderRowProps) {
  const navigate = useNavigate();
  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();
  const toggleFavorite = useToggleFavorite();
  const [renameOpen, setRenameOpen] = useState(false);
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleRowClick = (e: MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        "[data-checkbox], [data-dropdown-trigger]",
      )
    ) {
      return;
    }
    navigate({
      to: APP_ROUTES.PIPELINE_FOLDERS,
      search: { folderId: folder.id },
    });
  };

  const handleRename = (newName: string) => {
    renameFolder.mutate({ id: folder.id, name: newName });
    setRenameOpen(false);
  };

  const handleDelete = () => {
    deleteFolder.mutate(folder.id);
  };

  const handleDragStart = (e: DragEvent) => {
    if (!dragData) return;
    e.dataTransfer.setData(DRAG_MIME, dragData);
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
  };

  const handleDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const data = e.dataTransfer.getData(DRAG_MIME);
    if (data && onItemDrop) {
      onItemDrop(data);
    }
  };

  const formattedDate = folder.createdAt
    ? formatDate(new Date(folder.createdAt))
    : "N/A";

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50 group",
          isDragOver && "bg-primary/10 ring-1 ring-primary",
          isDragging && "opacity-50",
        )}
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
            onDragStart={handleDragStart}
            onDragEnd={() => onDragStateChange?.(false)}
            className={dragData ? "cursor-grab" : undefined}
          >
            <InlineStack gap="2" blockAlign="center">
              <Icon
                name="Folder"
                fill="currentColor"
                size="lg"
                className="text-muted-foreground shrink-0"
              />
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
        <TableCell className="w-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              data-dropdown-trigger
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <Icon name="EllipsisVertical" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onSelect={() => toggleFavorite.mutate(folder.id)}
              >
                <Icon
                  name="Star"
                  className={cn(
                    "mr-2 size-4",
                    folder.favorite && "fill-yellow-400 text-yellow-400",
                  )}
                />
                {folder.favorite ? "Unfavorite" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Icon name="Pencil" className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <ConfirmationDialog
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Icon name="Trash" className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                }
                title={`Delete folder "${folder.name}"?`}
                description="All pipelines inside this folder will be moved back to the root. Subfolders will be deleted. This action cannot be undone."
                onConfirm={handleDelete}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <RenameFolderDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={folder.name}
        onRename={handleRename}
      />
    </>
  );
}
