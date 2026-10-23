import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ExamplePipelines } from "@/components/Learn/ExamplePipelines";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Paragraph, Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import { usePagination } from "@/hooks/usePagination";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";
import { invalidatePipelineQueries } from "@/services/pipelineStorage/invalidatePipelineQueries";
import { PipelineMigrationRecoveryError } from "@/services/pipelineStorage/migrateLocalPipelineToRemote";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { isGraphImplementation } from "@/utils/componentSpec";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { getErrorMessage } from "@/utils/string";
import { componentSpecFromYaml } from "@/utils/yaml";

import BulkActionsBar from "./BulkActionsBar";
import { PipelineFiltersBar } from "./PipelineFiltersBar";
import PipelineRow from "./PipelineRow";
import { usePipelineFilters } from "./usePipelineFilters";

const DEFAULT_PAGE_SIZE = 10;

type Pipelines = Map<string, ComponentFileEntry>;

const PipelineSectionSkeleton = () => (
  <BlockStack className="h-full" gap="3">
    <InlineStack gap="2" align="space-between" className="w-full">
      <Skeleton size="lg" shape="button" />
      <Skeleton size="lg" shape="button" />
      <Skeleton size="lg" shape="button" />
    </InlineStack>
    <BlockStack className="h-[40vh] mt-4" gap="2" inlineAlign="space-between">
      <BlockStack gap="2">
        <Skeleton size="full" />
        <Skeleton size="half" />
        <Skeleton size="full" />
        <Skeleton size="half" />
        <Skeleton size="full" />
      </BlockStack>
      <BlockStack gap="2" align="end">
        <Skeleton size="lg" shape="button" />
      </BlockStack>
    </BlockStack>
  </BlockStack>
);

interface PipelineSectionProps {
  onPipelineClick?: (name: string) => void;
}

export const PipelineSection = withSuspenseWrapper(
  ({ onPipelineClick }: PipelineSectionProps) => {
    const storage = usePipelineStorage();
    const { backendUrl, ready, configured, available } = useBackend();
    const queryClient = useQueryClient();
    const notify = useToastNotification();
    const uploadConfirmation = useConfirmationDialog();
    const [pipelines, setPipelines] = useState<Pipelines>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(
      new Set(),
    );

    const { filteredPipelines, filterBarProps, filterKey } =
      usePipelineFilters(pipelines);

    const {
      paginatedItems: paginatedPipelines,
      currentPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      goToNextPage,
      goToPreviousPage,
      resetPage,
    } = usePagination(filteredPipelines, DEFAULT_PAGE_SIZE, filterKey);

    const fetchUserPipelines = async () => {
      setIsLoading(true);
      try {
        setPipelines(
          await getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME),
        );
      } catch (error) {
        console.error("Failed to load user pipelines:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const refreshUserPipelines = () => {
      void fetchUserPipelines();
      void queryClient.invalidateQueries({
        queryKey: LocalPipelinesQueryKeys.Names(),
      });
    };

    const { mutate: saveAsRemote, isPending: isSavingAsRemote } = useMutation({
      mutationFn: async (name: string) => {
        const local = await storage.resolvePipeline({ name });
        const content = await local.read();
        const spec = componentSpecFromYaml(content);
        const isEmpty =
          !local.remote &&
          !local.isDraft &&
          isGraphImplementation(spec.implementation) &&
          Object.keys(spec.implementation.graph.tasks ?? {}).length === 0;
        const confirmed = await uploadConfirmation.triggerDialog({
          title: isEmpty
            ? `Delete empty pipeline "${name}"?`
            : `Upload "${name}"?`,
          description: isEmpty
            ? "This pipeline has no tasks. Uploading it will delete the browser copy instead of creating a remote pipeline. This action cannot be undone. Cancel to keep it and add tasks."
            : "This pipeline and its configured input values will be saved to the selected backend. Other users with read access to that backend can see them. The uploaded pipeline appears in Remote Pipelines. Its browser copy and existing project links are kept. Open the pipeline from a project to update that project's link.",
          confirmLabel: isEmpty ? "Delete empty pipeline" : "Upload",
        });
        if (!confirmed) return "cancelled";
        if ((await local.read()) !== content) {
          throw new Error(
            "This pipeline changed while the confirmation was open. Nothing was uploaded or deleted. Try uploading again.",
          );
        }
        if (isEmpty) {
          await local.deleteFile();
          return "deleted";
        }
        await storage.moveLocalPipelineToRemote(local, backendUrl, undefined, {
          keepLocalCopy: true,
        });
        return "uploaded";
      },
      onSuccess: (result) => {
        if (result === "cancelled") return;
        setSelectedPipelines(new Set());
        notify(
          result === "deleted"
            ? "Empty pipeline deleted."
            : "Pipeline uploaded.",
          "success",
        );
      },
      onError: (error) =>
        notify(
          getErrorMessage(error),
          error instanceof PipelineMigrationRecoveryError ? "warning" : "error",
        ),
      onSettled: () => {
        void fetchUserPipelines();
        invalidatePipelineQueries(queryClient, backendUrl);
        void queryClient.invalidateQueries({
          queryKey: ["local-pipeline-migration"],
        });
      },
    });

    const handleSelectAll = (checked: boolean) => {
      setSelectedPipelines(
        checked ? new Set(filteredPipelines.map(([name]) => name)) : new Set(),
      );
    };

    const handleSelectPipeline = (name: string, checked: boolean) => {
      const next = new Set(selectedPipelines);
      if (checked) next.add(name);
      else next.delete(name);
      setSelectedPipelines(next);
    };

    useEffect(() => {
      fetchUserPipelines();
    }, []);

    if (isLoading) return <LoadingScreen message="Loading Pipelines" />;

    if (pipelines.size === 0) {
      return (
        <BlockStack gap="4" align="center">
          <BlockStack gap="2">
            <Paragraph size="md" tone="subdued">
              You don&apos;t have any pipelines yet. Get started with a template
              below.
            </Paragraph>
            <ExamplePipelines />
          </BlockStack>
          <BlockStack align="center" gap="2">
            <Text tone="subdued">Or start from scratch with</Text>
            <NewPipelineButton />
          </BlockStack>
        </BlockStack>
      );
    }

    const isAllSelected =
      filteredPipelines.length > 0 &&
      filteredPipelines.every(([name]) => selectedPipelines.has(name));

    return (
      <BlockStack gap="4" className="w-full">
        <ConfirmationDialog
          isOpen={uploadConfirmation.isOpen}
          title={uploadConfirmation.title}
          description={uploadConfirmation.description}
          confirmLabel={uploadConfirmation.confirmLabel}
          onConfirm={() => uploadConfirmation.handlers?.onConfirm()}
          onCancel={() => uploadConfirmation.handlers?.onCancel()}
        />
        <PipelineFiltersBar filters={filterBarProps} />

        <Table className="text-sm">
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Modified at</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPipelines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No pipelines found.
                </TableCell>
              </TableRow>
            )}
            {paginatedPipelines.map(([name, fileEntry, matchMetadata]) => (
              <PipelineRow
                key={fileEntry.componentRef.digest}
                name={name}
                componentRef={fileEntry.componentRef}
                modificationTime={fileEntry.modificationTime}
                onDelete={refreshUserPipelines}
                onSaveAsRemote={
                  createsLocalPipelines(configured)
                    ? undefined
                    : () => saveAsRemote(name)
                }
                saveAsRemoteDisabled={
                  isSavingAsRemote || !ready || !configured || !available
                }
                isSelected={selectedPipelines.has(name)}
                onSelect={(checked) => handleSelectPipeline(name, checked)}
                searchQuery={matchMetadata.searchQuery}
                matchedFields={matchMetadata.matchedFields}
                componentQuery={matchMetadata.componentQuery}
                matchedComponentNames={matchMetadata.matchedComponentNames}
                onPipelineClick={onPipelineClick}
              />
            ))}
          </TableBody>
        </Table>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          onReset={resetPage}
        />

        <Button onClick={refreshUserPipelines} className="mt-6 max-w-96">
          Refresh
        </Button>

        {selectedPipelines.size > 0 && (
          <BulkActionsBar
            selectedPipelines={Array.from(selectedPipelines)}
            onDeleteSuccess={() => {
              setSelectedPipelines(new Set());
              refreshUserPipelines();
            }}
            onClearSelection={() => setSelectedPipelines(new Set())}
          />
        )}
      </BlockStack>
    );
  },
  PipelineSectionSkeleton,
);
