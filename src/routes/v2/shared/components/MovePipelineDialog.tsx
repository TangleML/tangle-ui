import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useMovePipeline } from "@/routes/v2/shared/hooks/useMovePipeline";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { ROOT_FOLDER_ID } from "@/services/pipelineStorage/types";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import { getErrorMessage } from "@/utils/string";

interface MovePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineIds: string[];
  folderIds?: string[];
  currentFolderId: string | null;
  onMoveComplete: () => void;
}

export function MovePipelineDialog({
  open,
  onOpenChange,
  pipelineIds,
  folderIds = [],
  currentFolderId,
  onMoveComplete,
}: MovePipelineDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId,
  );
  const { mutateAsync: movePipeline } = useMovePipeline();
  const storage = usePipelineStorage();
  const notify = useToastNotification();

  const totalItems = pipelineIds.length + folderIds.length;

  const { mutate: handleMove, isPending: isMoving } = useMutation({
    mutationFn: async () => {
      await Promise.all([
        ...pipelineIds.map((id) =>
          movePipeline({ pipelineId: id, folderId: selectedFolderId }),
        ),
        ...folderIds.map(async (id) => {
          const folder = await storage.findFolderById(id);
          return folder.moveToParent(selectedFolderId);
        }),
      ]);
    },
    onSuccess: () => {
      onMoveComplete();
    },
    onError: (error) => {
      notify("Failed to move: " + getErrorMessage(error), "error");
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setSelectedFolderId(null);
  };

  const isSameFolder = selectedFolderId === currentFolderId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {totalItems} {totalItems !== 1 ? "items" : "item"}
          </DialogTitle>
        </DialogHeader>
        <BlockStack gap="2">
          <Text size="sm" tone="subdued">
            Select a destination folder:
          </Text>
          <FolderTree
            selectedFolderId={selectedFolderId}
            currentFolderId={currentFolderId}
            onSelect={setSelectedFolderId}
          />
        </BlockStack>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => handleMove()}
            disabled={isSameFolder || isMoving}
          >
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FolderTreeProps {
  selectedFolderId: string | null;
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}

const FolderTreeSkeleton = () => (
  <BlockStack gap="1">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-8 w-full" />
    ))}
  </BlockStack>
);

const FolderTree = withSuspenseWrapper(function FolderTreeContent({
  selectedFolderId,
  currentFolderId,
  onSelect,
}: FolderTreeProps) {
  const storage = usePipelineStorage();

  const { data: allFolders } = useSuspenseQuery({
    queryKey: [...FoldersQueryKeys.All(), "tree"],
    queryFn: () => storage.getAllFolders(),
  });

  const rootFolders = allFolders.filter((f) => f.parentId === ROOT_FOLDER_ID);

  return (
    <BlockStack
      gap="1"
      className="max-h-64 overflow-y-auto rounded-md border border-border p-2"
    >
      <FolderTreeItem
        folderId={null}
        label="Root"
        isSelected={selectedFolderId === null}
        isCurrent={currentFolderId === null}
        onSelect={() => onSelect(null)}
        depth={0}
      />
      {rootFolders.map((folder) => (
        <FolderTreeBranch
          key={folder.id}
          folder={folder}
          allFolders={allFolders}
          selectedFolderId={selectedFolderId}
          currentFolderId={currentFolderId}
          onSelect={onSelect}
          depth={1}
        />
      ))}
    </BlockStack>
  );
}, FolderTreeSkeleton);

interface FolderTreeBranchProps {
  folder: PipelineFolder;
  allFolders: PipelineFolder[];
  selectedFolderId: string | null;
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  depth: number;
}

function FolderTreeBranch({
  folder,
  allFolders,
  selectedFolderId,
  currentFolderId,
  onSelect,
  depth,
}: FolderTreeBranchProps) {
  const children = allFolders.filter((f) => f.parentId === folder.id);

  return (
    <>
      <FolderTreeItem
        folderId={folder.id}
        label={folder.name}
        isSelected={selectedFolderId === folder.id}
        isCurrent={currentFolderId === folder.id}
        disabled={!folder.canAcceptFiles}
        onSelect={() => onSelect(folder.id)}
        depth={depth}
      />
      {children.map((child) => (
        <FolderTreeBranch
          key={child.id}
          folder={child}
          allFolders={allFolders}
          selectedFolderId={selectedFolderId}
          currentFolderId={currentFolderId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

interface FolderTreeItemProps {
  folderId: string | null;
  label: string;
  isSelected: boolean;
  isCurrent: boolean;
  disabled?: boolean;
  onSelect: () => void;
  depth: number;
}

function FolderTreeItem({
  label,
  isSelected,
  isCurrent,
  disabled = false,
  onSelect,
  depth,
}: FolderTreeItemProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50",
        isSelected && !disabled && "bg-primary/10 ring-1 ring-primary",
        isCurrent && "text-muted-foreground",
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      title={
        disabled ? "This folder does not support moving pipelines" : undefined
      }
    >
      <Icon
        name={depth === 0 ? "House" : "Folder"}
        className="size-4 shrink-0"
      />
      <InlineStack gap="1" blockAlign="center">
        <Text size="sm">{label}</Text>
        {isCurrent && (
          <Text size="xs" tone="subdued">
            (current)
          </Text>
        )}
      </InlineStack>
    </button>
  );
}
