import { type ReactNode, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  useDeleteFolder,
  useRenameFolder,
  useToggleFavorite,
} from "@/routes/v2/pages/PipelineFolders/hooks/useFolderMutations";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

import { RenameFolderDialog } from "./RenameFolderDialog";

interface FolderRowMenuProps {
  folder: PipelineFolder;
  hideDefaultMenuItems: boolean;
  extraMenuItems: ReactNode;
}

export function FolderRowMenu({
  folder,
  hideDefaultMenuItems,
  extraMenuItems,
}: FolderRowMenuProps) {
  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();
  const toggleFavorite = useToggleFavorite();
  const [renameOpen, setRenameOpen] = useState(false);

  const handleRename = (newName: string) => {
    renameFolder.mutate({ id: folder.id, name: newName });
    setRenameOpen(false);
  };

  const handleDelete = () => {
    deleteFolder.mutate(folder.id);
  };

  return (
    <>
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
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {!hideDefaultMenuItems && (
            <>
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
            </>
          )}
          {extraMenuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {!hideDefaultMenuItems && (
        <RenameFolderDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          currentName={folder.name}
          onRename={handleRename}
        />
      )}
    </>
  );
}
