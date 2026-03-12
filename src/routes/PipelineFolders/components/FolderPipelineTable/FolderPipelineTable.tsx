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

import { useBulkDeleteMutation } from "../../hooks/useBulkDeleteMutation";
import { useConnectedFolderPipelines } from "../../hooks/useConnectedFolderPipelines";
import {
  useConnectedFoldersInParent,
  useRemoveConnectedFolder,
} from "../../hooks/useConnectedFolders";
import { useDropMutation } from "../../hooks/useDropMutation";
import { useFolderBreadcrumbs } from "../../hooks/useFolderBreadcrumbs";
import { useFolderPipelines } from "../../hooks/useFolderPipelines";
import { useFolders } from "../../hooks/useFolders";
import { useImportLocalPipeline } from "../../hooks/useImportLocalPipeline";
import { useSelection } from "../../hooks/useSelection";
import { type DragItem, type PipelineFolder } from "../../types";
import { MovePipelineDialog } from "../MovePipelineDialog";
import { ConnectedFolderPermissionBanner } from "./components/ConnectedFolderPermissionBanner";
import { FolderList } from "./components/FolderList";
import { LocalPipelineRows } from "./components/LocalPipelineRows";
import { ParentFolderRow } from "./components/ParentFolderRow";
import { RegularPipelineRows } from "./components/RegularPipelineRows";
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
    const { data: folders } = useFolders(folderId);
    const { data: pipelines, refetch } = useFolderPipelines(folderId);
    const { data: breadcrumbPath } = useFolderBreadcrumbs(folderId);
    const { data: connectedFolders } = useConnectedFoldersInParent(folderId);
    const connectedFolderContent = useConnectedFolderPipelines(folderId);

    const selection = useSelection();
    const [searchQuery, setSearchQuery] = useState("");
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);
    const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());

    const {
      mutate: removeConnectedFolder,
      isPending: isRemovingConnectedFolder,
    } = useRemoveConnectedFolder();

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

    const { mutate: importLocal, variables: importVariables } =
      useImportLocalPipeline();

    const isInsideConnectedFolder = connectedFolderContent.isConnectedFolder;

    const connectedFoldersPipelineFolders: PipelineFolder[] =
      connectedFolders.map((cf) => ({
        id: cf.id,
        name: cf.name,
        parentId: cf.parentId,
        createdAt: cf.connectedAt,
      }));

    const allFolders = [...folders, ...connectedFoldersPipelineFolders];

    const filteredFolders = folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const filteredConnectedFolders = connectedFoldersPipelineFolders.filter(
      (f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const filteredPipelines = isInsideConnectedFolder
      ? []
      : pipelines.filter(([name]) =>
          name.toLowerCase().includes(searchQuery.toLowerCase()),
        );

    const localPipelineFiles = isInsideConnectedFolder
      ? connectedFolderContent.files.filter((f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : [];

    const regularPagination = usePagination(filteredPipelines);
    const localPagination = usePagination(localPipelineFiles);

    const activePagination = isInsideConnectedFolder
      ? localPagination
      : regularPagination;

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      regularPagination.resetPage();
      localPagination.resetPage();
    };

    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        const pipelineIds = isInsideConnectedFolder
          ? localPipelineFiles.map((f) => f.fileName)
          : filteredPipelines.map(([name]) => name);
        const folderIds = [
          ...filteredFolders.map((f) => f.id),
          ...filteredConnectedFolders.map((f) => f.id),
        ];
        selection.selectAll({ pipelineIds, folderIds });
      } else {
        selection.clearSelection();
      }
    };

    const getDragItems = (item: DragItem): DragItem[] => {
      const isItemSelected =
        (item.type === "pipeline" &&
          selection.selectedPipelines.has(item.id)) ||
        ((item.type === "folder" || item.type === "connected-folder") &&
          selection.selectedFolders.has(item.id));

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

    const hasContent =
      allFolders.length > 0 ||
      pipelines.length > 0 ||
      localPipelineFiles.length > 0;

    const isAllSelected =
      hasContent &&
      filteredFolders.every((f) => selection.selectedFolders.has(f.id)) &&
      filteredConnectedFolders.every((f) =>
        selection.selectedFolders.has(f.id),
      ) &&
      (isInsideConnectedFolder
        ? localPipelineFiles.every((f) =>
            selection.selectedPipelines.has(f.fileName),
          )
        : filteredPipelines.every(([name]) =>
            selection.selectedPipelines.has(name),
          ));

    const connectedFolderIds = new Set(connectedFolders.map((cf) => cf.id));

    return (
      <BlockStack gap="4" className="w-full">
        {isInsideConnectedFolder && (
          <ConnectedFolderPermissionBanner
            connectedFolderContent={connectedFolderContent}
          />
        )}

        {hasContent ||
        (isInsideConnectedFolder &&
          connectedFolderContent.permission === "granted") ? (
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
                connectedFolders={filteredConnectedFolders}
                selectedFolders={selection.selectedFolders}
                draggingIds={draggingIds}
                getDragItems={getDragItems}
                onSelectFolder={selection.selectFolder}
                onDrop={(targetFolderId, data) =>
                  handleDrop({ targetFolderId, rawData: data })
                }
                onDragStateChange={handleDragStateChange}
                removeConnectedFolder={removeConnectedFolder}
                isRemovingConnectedFolder={isRemovingConnectedFolder}
              />

              {isInsideConnectedFolder ? (
                <LocalPipelineRows
                  pipelines={localPagination.paginatedItems}
                  selectedPipelines={selection.selectedPipelines}
                  onSelectPipeline={selection.selectPipeline}
                  onImport={importLocal}
                  importingFileName={importVariables?.fileName}
                />
              ) : (
                <RegularPipelineRows
                  pipelines={regularPagination.paginatedItems}
                  selectedPipelines={selection.selectedPipelines}
                  draggingIds={draggingIds}
                  getDragItems={getDragItems}
                  onSelectPipeline={selection.selectPipeline}
                  onDragStateChange={handleDragStateChange}
                  onDelete={() => refetch()}
                />
              )}

              {filteredFolders.length === 0 &&
                filteredConnectedFolders.length === 0 &&
                filteredPipelines.length === 0 &&
                localPipelineFiles.length === 0 && (
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
          currentPage={activePagination.currentPage}
          totalPages={activePagination.totalPages}
          hasNextPage={activePagination.hasNextPage}
          hasPreviousPage={activePagination.hasPreviousPage}
          onNextPage={activePagination.goToNextPage}
          onPreviousPage={activePagination.goToPreviousPage}
          onReset={activePagination.resetPage}
        />

        <SelectionToolbar
          totalSelected={selection.totalSelected}
          onMove={() => setMoveDialogOpen(true)}
          onDelete={() => bulkDelete(Array.from(selection.selectedPipelines))}
          onClear={selection.clearSelection}
          isDeleting={isBulkDeleting}
        />

        <MovePipelineDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          pipelineNames={Array.from(selection.selectedPipelines)}
          folderIds={Array.from(selection.selectedFolders).filter(
            (id) => !connectedFolderIds.has(id),
          )}
          currentFolderId={folderId}
          onMoveComplete={handleMoveComplete}
        />
      </BlockStack>
    );
  },
  FolderPipelineTableSkeleton,
);
