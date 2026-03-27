import { useQueryClient } from "@tanstack/react-query";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import type { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

import type { DragItem } from "../../../types";
import { FolderRow } from "../../FolderRow";

interface FolderListProps {
  folders: PipelineFolder[];
  selectedFolders: Set<string>;
  draggingIds: Set<string>;
  canDrag?: boolean;
  getDragItems: (item: DragItem) => DragItem[];
  onSelectFolder: (id: string, checked: boolean) => void;
  onDrop: (targetFolderId: string, data: string) => void;
  onDragStateChange: (items: DragItem[], isDragging: boolean) => void;
  disconnectFolder: (id: string) => void;
  isDisconnecting?: boolean;
}

export function FolderList({
  folders,
  selectedFolders,
  draggingIds,
  canDrag = true,
  getDragItems,
  onSelectFolder,
  onDrop,
  onDragStateChange,
  disconnectFolder,
  isDisconnecting,
}: FolderListProps) {
  const queryClient = useQueryClient();

  return (
    <>
      {folders.map((folder) => {
        const folderItem: DragItem = { type: "folder", id: folder.id };
        const items = getDragItems(folderItem);
        const isPermissionGated = folder.requiresPermission;

        return (
          <FolderRow
            key={folder.id}
            folder={folder}
            isSelected={selectedFolders.has(folder.id)}
            onSelect={(checked) => onSelectFolder(folder.id, checked)}
            onItemDrop={(data) => onDrop(folder.id, data)}
            canAcceptDrop={folder.canAcceptFiles}
            dragData={canDrag ? JSON.stringify(items) : undefined}
            isDragging={draggingIds.has(folder.id)}
            dragItemCount={items.length}
            onDragStateChange={(dragging) => onDragStateChange(items, dragging)}
            icon={
              isPermissionGated ? (
                <Icon
                  name="HardDrive"
                  size="lg"
                  className="text-muted-foreground shrink-0"
                />
              ) : undefined
            }
            hideDefaultMenuItems={isPermissionGated}
            extraMenuItems={
              isPermissionGated ? (
                <>
                  <DropdownMenuItem
                    onSelect={() =>
                      queryClient.invalidateQueries({
                        queryKey: ["pipeline-folders"],
                      })
                    }
                  >
                    <Icon name="RefreshCw" className="mr-2 size-4" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => disconnectFolder(folder.id)}
                    disabled={isDisconnecting}
                    className="text-destructive focus:text-destructive"
                  >
                    <Icon name="Unplug" className="mr-2 size-4" />
                    Disconnect
                  </DropdownMenuItem>
                </>
              ) : undefined
            }
          />
        );
      })}
    </>
  );
}
