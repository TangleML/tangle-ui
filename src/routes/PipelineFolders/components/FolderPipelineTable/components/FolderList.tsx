import { useQueryClient } from "@tanstack/react-query";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import {
  ConnectedFoldersQueryKeys,
  type DragItem,
  type PipelineFolder,
} from "../../../types";
import { FolderRow } from "../../FolderRow";

interface FolderListProps {
  folders: PipelineFolder[];
  connectedFolders: PipelineFolder[];
  selectedFolders: Set<string>;
  draggingIds: Set<string>;
  getDragItems: (item: DragItem) => DragItem[];
  onSelectFolder: (id: string, checked: boolean) => void;
  onDrop: (targetFolderId: string, data: string) => void;
  onDragStateChange: (items: DragItem[], isDragging: boolean) => void;
  removeConnectedFolder: (id: string) => void;
  isRemovingConnectedFolder?: boolean;
}

export function FolderList({
  folders,
  connectedFolders,
  selectedFolders,
  draggingIds,
  getDragItems,
  onSelectFolder,
  onDrop,
  onDragStateChange,
  removeConnectedFolder,
  isRemovingConnectedFolder,
}: FolderListProps) {
  const queryClient = useQueryClient();

  return (
    <>
      {folders.map((folder) => {
        const folderItem: DragItem = { type: "folder", id: folder.id };
        const items = getDragItems(folderItem);
        return (
          <FolderRow
            key={folder.id}
            folder={folder}
            isSelected={selectedFolders.has(folder.id)}
            onSelect={(checked) => onSelectFolder(folder.id, checked)}
            onItemDrop={(data) => onDrop(folder.id, data)}
            dragData={JSON.stringify(items)}
            isDragging={draggingIds.has(folder.id)}
            dragItemCount={items.length}
            onDragStateChange={(dragging) => onDragStateChange(items, dragging)}
          />
        );
      })}
      {connectedFolders.map((folder) => {
        const folderItem: DragItem = {
          type: "connected-folder",
          id: folder.id,
        };
        const items = getDragItems(folderItem);
        return (
          <FolderRow
            key={folder.id}
            folder={folder}
            isSelected={selectedFolders.has(folder.id)}
            onSelect={(checked) => onSelectFolder(folder.id, checked)}
            onItemDrop={(data) => onDrop(folder.id, data)}
            dragData={JSON.stringify(items)}
            isDragging={draggingIds.has(folder.id)}
            dragItemCount={items.length}
            onDragStateChange={(dragging) => onDragStateChange(items, dragging)}
            icon={
              <Icon
                name="HardDrive"
                size="lg"
                className="text-muted-foreground shrink-0"
              />
            }
            hideDefaultMenuItems
            extraMenuItems={
              <>
                <DropdownMenuItem
                  onSelect={() =>
                    queryClient.invalidateQueries({
                      queryKey: ConnectedFoldersQueryKeys.Files(folder.id),
                    })
                  }
                >
                  <Icon name="RefreshCw" className="mr-2 size-4" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => removeConnectedFolder(folder.id)}
                  disabled={isRemovingConnectedFolder}
                  className="text-destructive focus:text-destructive"
                >
                  <Icon name="Unplug" className="mr-2 size-4" />
                  Disconnect
                </DropdownMenuItem>
              </>
            }
          />
        );
      })}
    </>
  );
}
