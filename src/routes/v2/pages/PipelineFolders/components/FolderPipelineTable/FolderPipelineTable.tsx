import { useSuspenseQuery } from "@tanstack/react-query";
import { type ChangeEvent, useState } from "react";

import { PaginationControls } from "@/components/shared/PaginationControls";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { usePagination } from "@/hooks/usePagination";
import { MovePipelineDialog } from "@/routes/v2/pages/PipelineFolders/components/MovePipelineDialog";
import { useBulkDeleteMutation } from "@/routes/v2/pages/PipelineFolders/hooks/useBulkDeleteMutation";
import { useDropMutation } from "@/routes/v2/pages/PipelineFolders/hooks/useDropMutation";
import { useFolderBreadcrumbs } from "@/routes/v2/pages/PipelineFolders/hooks/useFolderBreadcrumbs";
import { useDisconnectFolder } from "@/routes/v2/pages/PipelineFolders/hooks/useFolderMutations";
import { useFolderPipelines } from "@/routes/v2/pages/PipelineFolders/hooks/useFolderPipelines";
import { useFolders } from "@/routes/v2/pages/PipelineFolders/hooks/useFolders";
import { useSelection } from "@/routes/v2/pages/PipelineFolders/hooks/useSelection";
import { type DragItem } from "@/routes/v2/pages/PipelineFolders/types";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";

import { FolderList } from "./components/FolderList";
import { FolderPermissionBanner } from "./components/FolderPermissionBanner";
import { ParentFolderRow } from "./components/ParentFolderRow";
import { PipelineRows } from "./components/PipelineRows";
import { SelectionToolbar } from "./components/SelectionToolbar";

interface FolderPipelineTableProps {
  folderId: string | null;
}

const FolderPipelineTableSkeleton = () => (
  <BlockStack gap="3">
    <Skeleton size="lg" shape="button" />
    <BlockStack gap="2">
      <Skeleton size="full" />
      <Skeleton size="half" />
      <Skeleton size="full" />
    </BlockStack>
  </BlockStack>
);

export const FolderPipelineTable = withSuspenseWrapper(
  function FolderPipelineTableContent({ folderId }: FolderPipelineTableProps) {
    const storage = usePipelineStorage();

    const { data: currentFolder } = useSuspenseQuery({
      queryKey: [...FoldersQueryKeys.Pipelines(folderId), "folder"],
      queryFn: () =>
        folderId === null
          ? Promise.resolve(storage.rootFolder)
          : storage.findFolderById(folderId),
    });

    const { data: folders } = useFolders(folderId);
    const { data: pipelines, refetch } = useFolderPipelines(folderId);
    const { data: breadcrumbPath } = useFolderBreadcrumbs(folderId);

    const selection = useSelection();
    const [searchQuery, setSearchQuery] = useState("");
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);
    const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());

    const { mutate: disconnectFolder, isPending: isDisconnecting } =
      useDisconnectFolder();

    const { mutate: handleDrop } = useDropMutation({
      onSettled: selection.clearSelection,
    });

    const { mutate: bulkDelete, isPending: isBulkDeleting } =
      useBulkDeleteMutation({
        onSettled: () => {
          selection.clearSelection();
          refetch();
        },
      });

    const requiresPermission = currentFolder.requiresPermission;
    const canMoveOut = currentFolder.canMoveFilesOut;

    const filteredFolders = folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const filteredPipelines = pipelines.filter((p) =>
      p.storageKey.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const pagination = usePagination(filteredPipelines);

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      pagination.resetPage();
    };

    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        const pipelineIds = filteredPipelines.map((p) => p.id);
        const folderIds = filteredFolders.map((f) => f.id);
        selection.selectAll({ pipelineIds, folderIds });
      } else {
        selection.clearSelection();
      }
    };

    const getDragItems = (item: DragItem): DragItem[] => {
      const isItemSelected =
        (item.type === "pipeline" &&
          selection.selectedPipelines.has(item.id)) ||
        (item.type === "folder" && selection.selectedFolders.has(item.id));

      if (isItemSelected && selection.totalSelected > 1) {
        return [
          ...Array.from(selection.selectedPipelines).map(
            (id): DragItem => ({ type: "pipeline", id }),
          ),
          ...Array.from(selection.selectedFolders).map(
            (id): DragItem => ({ type: "folder", id }),
          ),
        ];
      }

      return [item];
    };

    const handleDragStateChange = (items: DragItem[], isDragging: boolean) => {
      setDraggingIds(isDragging ? new Set(items.map((i) => i.id)) : new Set());
    };

    const handleMoveComplete = () => {
      selection.clearSelection();
      setMoveDialogOpen(false);
    };

    const hasContent = folders.length > 0 || pipelines.length > 0;

    const isAllSelected =
      hasContent &&
      filteredFolders.every((f) => selection.selectedFolders.has(f.id)) &&
      filteredPipelines.every((p) => selection.selectedPipelines.has(p.id));

    return (
      <BlockStack gap="4" className="w-full">
        {requiresPermission && (
          <FolderPermissionBanner folder={currentFolder} onGranted={refetch} />
        )}

        {hasContent ? (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-36">Modified at</TableHead>
                <TableHead className="w-36">Tags</TableHead>
                <TableHead className="w-36">Last run</TableHead>
                <TableHead className="w-16">Runs</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell></TableCell>
                <TableCell>
                  <BlockStack className="w-full">
                    <InlineStack gap="1" wrap="nowrap" className="w-full">
                      <Input
                        type="text"
                        className="w-full"
                        value={searchQuery}
                        onChange={handleSearch}
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          onClick={() => setSearchQuery("")}
                        >
                          <Icon name="CircleX" />
                        </Button>
                      )}
                    </InlineStack>
                  </BlockStack>
                </TableCell>
              </TableRow>

              {folderId !== null && (
                <ParentFolderRow breadcrumbPath={breadcrumbPath} />
              )}

              <FolderList
                folders={filteredFolders}
                selectedFolders={selection.selectedFolders}
                draggingIds={draggingIds}
                canDrag={canMoveOut}
                getDragItems={getDragItems}
                onSelectFolder={selection.selectFolder}
                onDrop={(targetFolderId, data) =>
                  handleDrop({ targetFolderId, rawData: data })
                }
                onDragStateChange={handleDragStateChange}
                disconnectFolder={disconnectFolder}
                isDisconnecting={isDisconnecting}
              />

              <PipelineRows
                pipelines={pagination.paginatedItems}
                selectedPipelines={selection.selectedPipelines}
                draggingIds={draggingIds}
                canDrag={canMoveOut}
                getDragItems={getDragItems}
                onSelectPipeline={selection.selectPipeline}
                onDragStateChange={handleDragStateChange}
                onDelete={() => refetch()}
              />

              {filteredFolders.length === 0 &&
                filteredPipelines.length === 0 && (
                  <TableRow>No items found.</TableRow>
                )}
            </TableBody>
          </Table>
        ) : (
          <BlockStack align="center" className="py-8">
            <Text tone="subdued">This folder is empty.</Text>
          </BlockStack>
        )}

        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          hasNextPage={pagination.hasNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          onNextPage={pagination.goToNextPage}
          onPreviousPage={pagination.goToPreviousPage}
          onReset={pagination.resetPage}
        />

        <SelectionToolbar
          totalSelected={selection.totalSelected}
          canMove={canMoveOut}
          onMove={() => setMoveDialogOpen(true)}
          onDelete={() => bulkDelete(Array.from(selection.selectedPipelines))}
          onClear={selection.clearSelection}
          isDeleting={isBulkDeleting}
        />

        <MovePipelineDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          pipelineIds={Array.from(selection.selectedPipelines)}
          folderIds={Array.from(selection.selectedFolders)}
          currentFolderId={folderId}
          onMoveComplete={handleMoveComplete}
        />
      </BlockStack>
    );
  },
  FolderPipelineTableSkeleton,
);
