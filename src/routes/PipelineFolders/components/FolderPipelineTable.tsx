import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, useState } from "react";

import PipelineRow from "@/components/Home/PipelineSection/PipelineRow";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
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
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/router";
import { deletePipeline } from "@/services/pipelineService";
import { getErrorMessage, pluralize } from "@/utils/string";

import { useFolderBreadcrumbs } from "../hooks/useFolderBreadcrumbs";
import { useFolderPipelines } from "../hooks/useFolderPipelines";
import { useFolders } from "../hooks/useFolders";
import { useMovePipeline } from "../hooks/useMovePipeline";
import { moveFolder } from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";
import { FolderRow } from "./FolderRow";
import { MovePipelineDialog } from "./MovePipelineDialog";

const DEFAULT_PAGE_SIZE = 10;

function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    paginatedItems,
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    goToNextPage: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
    goToPreviousPage: () => setCurrentPage((p) => Math.max(1, p - 1)),
    resetPage: () => setCurrentPage(1),
  };
}

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
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(
      new Set(),
    );
    const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
      new Set(),
    );
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);
    const notify = useToastNotification();
    const movePipeline = useMovePipeline();
    const queryClient = useQueryClient();
    const totalSelected = selectedPipelines.size + selectedFolders.size;
    const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());

    type DragItem = { type: "pipeline" | "folder"; id: string };

    const getDragItems = (item: DragItem): DragItem[] => {
      const isItemSelected =
        (item.type === "pipeline" && selectedPipelines.has(item.id)) ||
        (item.type === "folder" && selectedFolders.has(item.id));

      if (isItemSelected && totalSelected > 1) {
        return [
          ...Array.from(selectedPipelines).map(
            (id): DragItem => ({ type: "pipeline", id }),
          ),
          ...Array.from(selectedFolders).map(
            (id): DragItem => ({ type: "folder", id }),
          ),
        ];
      }

      return [item];
    };

    const handleDragStateChange = (items: DragItem[], isDragging: boolean) => {
      setDraggingIds(isDragging ? new Set(items.map((i) => i.id)) : new Set());
    };

    const handleDrop = async (targetFolderId: string, rawData: string) => {
      try {
        const items = JSON.parse(rawData) as DragItem[];
        let movedCount = 0;

        for (const item of items) {
          if (item.type === "pipeline") {
            await movePipeline.mutateAsync({
              pipelineName: item.id,
              folderId: targetFolderId,
            });
            movedCount++;
          } else if (item.type === "folder" && item.id !== targetFolderId) {
            await moveFolder(item.id, targetFolderId);
            movedCount++;
          }
        }

        if (movedCount > 0) {
          queryClient.invalidateQueries({
            queryKey: FoldersQueryKeys.All(),
          });
          notify(
            `Moved ${movedCount} ${pluralize(movedCount, "item")}`,
            "success",
          );
          setSelectedPipelines(new Set());
          setSelectedFolders(new Set());
        }
      } catch (error) {
        notify("Failed to move: " + getErrorMessage(error), "error");
      }
    };

    const filteredFolders = folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const filteredPipelines = pipelines.filter(([name]) =>
      name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const {
      paginatedItems: paginatedPipelines,
      currentPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      goToNextPage,
      goToPreviousPage,
      resetPage,
    } = usePagination(filteredPipelines);

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      resetPage();
    };

    const handleSelectAllPipelines = (checked: boolean) => {
      if (checked) {
        setSelectedPipelines(new Set(filteredPipelines.map(([name]) => name)));
        setSelectedFolders(new Set(filteredFolders.map((f) => f.id)));
      } else {
        setSelectedPipelines(new Set());
        setSelectedFolders(new Set());
      }
    };

    const handleSelectPipeline = (pipelineName: string, checked: boolean) => {
      setSelectedPipelines((prev) => {
        const next = new Set(prev);
        if (checked) next.add(pipelineName);
        else next.delete(pipelineName);
        return next;
      });
    };

    const handleSelectFolder = (folderId: string, checked: boolean) => {
      setSelectedFolders((prev) => {
        const next = new Set(prev);
        if (checked) next.add(folderId);
        else next.delete(folderId);
        return next;
      });
    };

    const handleBulkDelete = async () => {
      try {
        await Promise.all(
          Array.from(selectedPipelines).map((name) => deletePipeline(name)),
        );
        const totalDeleted = selectedPipelines.size + selectedFolders.size;
        notify(
          `${totalDeleted} ${pluralize(totalDeleted, "item")} deleted`,
          "success",
        );
        setSelectedPipelines(new Set());
        setSelectedFolders(new Set());
        refetch();
      } catch (error) {
        notify("Failed to delete: " + getErrorMessage(error), "error");
      }
    };

    const handleMoveComplete = () => {
      setSelectedPipelines(new Set());
      setSelectedFolders(new Set());
      setMoveDialogOpen(false);
    };

    const hasContent = folders.length > 0 || pipelines.length > 0;

    const isAllSelected =
      hasContent &&
      filteredFolders.every((f) => selectedFolders.has(f.id)) &&
      filteredPipelines.every(([name]) => selectedPipelines.has(name));

    return (
      <BlockStack gap="4" className="w-full">
        {hasContent ? (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAllPipelines}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-36">Modified at</TableHead>
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
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    const parentId =
                      breadcrumbPath[breadcrumbPath.length - 1]?.parentId ??
                      null;
                    navigate({
                      to: APP_ROUTES.PIPELINE_FOLDERS,
                      search: parentId ? { folderId: parentId } : {},
                    });
                  }}
                >
                  <TableCell />
                  <TableCell>
                    <InlineStack gap="2" blockAlign="center">
                      <Icon
                        name="CornerLeftUp"
                        className="text-muted-foreground shrink-0"
                      />
                      <Text size="sm" tone="subdued">
                        ..
                      </Text>
                    </InlineStack>
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
              {filteredFolders.map((folder) => {
                const folderItem: DragItem = {
                  type: "folder",
                  id: folder.id,
                };
                const items = getDragItems(folderItem);
                return (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    isSelected={selectedFolders.has(folder.id)}
                    onSelect={(checked) =>
                      handleSelectFolder(folder.id, checked)
                    }
                    onItemDrop={(data) => handleDrop(folder.id, data)}
                    dragData={JSON.stringify(items)}
                    isDragging={draggingIds.has(folder.id)}
                    dragItemCount={items.length}
                    onDragStateChange={(dragging) =>
                      handleDragStateChange(items, dragging)
                    }
                  />
                );
              })}
              {paginatedPipelines.map(([name, fileEntry]) => {
                const pipelineItem: DragItem = {
                  type: "pipeline",
                  id: name,
                };
                const items = getDragItems(pipelineItem);
                return (
                  <PipelineRow
                    key={fileEntry.componentRef.digest}
                    name={name}
                    modificationTime={fileEntry.modificationTime}
                    onDelete={() => refetch()}
                    isSelected={selectedPipelines.has(name)}
                    onSelect={(checked) => handleSelectPipeline(name, checked)}
                    icon={
                      <Icon
                        name="FileSpreadsheet"
                        fill="currentColor"
                        stroke="#2563eb"
                        size="lg"
                        className="shrink-0 text-blue-500"
                      />
                    }
                    dragData={JSON.stringify(items)}
                    isDragging={draggingIds.has(name)}
                    dragItemCount={items.length}
                    onDragStateChange={(dragging) =>
                      handleDragStateChange(items, dragging)
                    }
                  />
                );
              })}
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

        {totalPages > 1 && (
          <InlineStack
            gap="2"
            align="space-between"
            blockAlign="center"
            className="w-full"
          >
            <InlineStack gap="2" blockAlign="center">
              <Button
                variant="outline"
                onClick={resetPage}
                disabled={currentPage === 1}
              >
                <Icon name="ChevronFirst" />
              </Button>
              <Button
                variant="outline"
                onClick={goToPreviousPage}
                disabled={!hasPreviousPage}
              >
                <Icon name="ChevronLeft" />
                Previous
              </Button>
            </InlineStack>
            <Text size="sm" tone="subdued">
              Page {currentPage} of {totalPages}
            </Text>
            <Button
              variant="outline"
              onClick={goToNextPage}
              disabled={!hasNextPage}
            >
              Next
              <Icon name="ChevronRight" />
            </Button>
          </InlineStack>
        )}

        {totalSelected > 0 && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-lg">
            <InlineStack gap="4" blockAlign="center">
              <Text size="sm" weight="semibold">
                {totalSelected} {pluralize(totalSelected, "item")} selected
              </Text>
              <InlineStack gap="2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMoveDialogOpen(true)}
                >
                  <Icon name="FolderInput" />
                  Move
                </Button>
                <ConfirmationDialog
                  trigger={
                    <Button variant="destructive" size="sm">
                      <Icon name="Trash2" />
                      Delete
                    </Button>
                  }
                  title={`Delete ${totalSelected} ${pluralize(totalSelected, "item")}?`}
                  description="Are you sure? Pipelines runs will not be impacted. Deleted folders will have their contents moved to root. This action cannot be undone."
                  onConfirm={handleBulkDelete}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPipelines(new Set());
                    setSelectedFolders(new Set());
                  }}
                >
                  <Icon name="X" />
                </Button>
              </InlineStack>
            </InlineStack>
          </div>
        )}

        <MovePipelineDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          pipelineNames={Array.from(selectedPipelines)}
          folderIds={Array.from(selectedFolders)}
          currentFolderId={folderId}
          onMoveComplete={handleMoveComplete}
        />
      </BlockStack>
    );
  },
  FolderPipelineTableSkeleton,
);
