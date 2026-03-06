import { useSuspenseQuery } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";

import { useMovePipeline } from "../hooks/useMovePipeline";
import { getAllFolders, moveFolder } from "../services/folderStorage";
import { FoldersQueryKeys, type PipelineFolder } from "../types";

interface MovePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineNames: string[];
  folderIds?: string[];
  currentFolderId: string | null;
  onMoveComplete: () => void;
}

export function MovePipelineDialog({
  open,
  onOpenChange,
  pipelineNames,
  folderIds = [],
  currentFolderId,
  onMoveComplete,
}: MovePipelineDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId,
  );
  const { mutate: movePipeline } = useMovePipeline();
  const [isMoving, setIsMoving] = useState(false);

  const totalItems = pipelineNames.length + folderIds.length;

  const handleMove = async () => {
    // todo: move to separate mutation hook
    setIsMoving(true);
    try {
      for (const name of pipelineNames) {
        await movePipeline({
          pipelineName: name,
          folderId: selectedFolderId,
        });
      }
      for (const id of folderIds) {
        await moveFolder(id, selectedFolderId);
      }
      onMoveComplete();
    } finally {
      setIsMoving(false);
    }
  };

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
          <Button onClick={handleMove} disabled={isSameFolder || isMoving}>
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
  const { data: allFolders } = useSuspenseQuery({
    queryKey: [...FoldersQueryKeys.All(), "tree"],
    queryFn: getAllFolders,
  });

  const rootFolders = allFolders.filter((f) => f.parentId === null);

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
  onSelect: () => void;
  depth: number;
}

function FolderTreeItem({
  label,
  isSelected,
  isCurrent,
  onSelect,
  depth,
}: FolderTreeItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50",
        isSelected && "bg-primary/10 ring-1 ring-primary",
        isCurrent && "text-muted-foreground",
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
