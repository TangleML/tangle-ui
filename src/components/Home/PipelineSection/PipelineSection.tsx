import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ExamplePipelines } from "@/components/Learn/ExamplePipelines";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { PipelineStorageError } from "@/components/shared/PipelineStorageError";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
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
import { usePagination } from "@/hooks/usePagination";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import BulkActionsBar from "./BulkActionsBar";
import { HostMigrationNotice } from "./HostMigrationNotice";
import { PipelineFiltersBar } from "./PipelineFiltersBar";
import PipelineRow from "./PipelineRow";
import { useHostMigration } from "./useHostMigration";
import { usePipelineFilters } from "./usePipelineFilters";
import { usePipelineListEntries } from "./usePipelineListEntries";

const DEFAULT_PAGE_SIZE = 10;

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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const storage = usePipelineStorage();
    const { entries, isLoading, error, pendingCount, refetch } =
      usePipelineListEntries();

    const migration = useHostMigration(refetch);

    const { filteredPipelines, filterBarProps, filterKey } = usePipelineFilters(
      entries,
      pendingCount,
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
    } = usePagination(filteredPipelines, DEFAULT_PAGE_SIZE, filterKey);

    const handleSelectAll = (checked: boolean) => {
      setSelectedIds(
        checked
          ? new Set(filteredPipelines.map(({ entry }) => entry.file.id))
          : new Set(),
      );
    };

    const handleSelectPipeline = (id: string, checked: boolean) => {
      const next = new Set(selectedIds);
      if (checked) next.add(id);
      else next.delete(id);
      setSelectedIds(next);
    };

    if (migration.phase === "copying" || migration.phase === "incomplete") {
      return (
        <HostMigrationNotice
          migration={migration}
          storageLabel={storage.rootFolder.name}
        />
      );
    }

    if (isLoading || migration.phase === "checking") {
      return <LoadingScreen message="Loading Pipelines" />;
    }

    if (error) {
      return <PipelineStorageError error={error} onRetry={() => refetch()} />;
    }

    if (entries.length === 0) {
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

    const selectedFiles = entries
      .filter(({ file }) => selectedIds.has(file.id))
      .map(({ file }) => file);

    const isAllSelected =
      filteredPipelines.length > 0 &&
      filteredPipelines.every(({ entry }) => selectedIds.has(entry.file.id));

    return (
      <BlockStack gap="4" className="w-full">
        <PipelineFiltersBar
          filters={filterBarProps}
          actions={<ExamplePipelineButton />}
        />

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
            {paginatedPipelines.map(({ entry, match }) => (
              <PipelineRow
                key={entry.file.id}
                name={entry.file.displayName}
                fileId={entry.file.id}
                spec={entry.spec}
                modificationTime={entry.file.modifiedAt}
                onDelete={refetch}
                isSelected={selectedIds.has(entry.file.id)}
                onSelect={(checked) =>
                  handleSelectPipeline(entry.file.id, checked)
                }
                searchQuery={match.searchQuery}
                matchedFields={match.matchedFields}
                componentQuery={match.componentQuery}
                matchedComponentNames={match.matchedComponentNames}
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

        <Button onClick={() => refetch()} className="mt-6 max-w-96">
          Refresh
        </Button>

        {selectedFiles.length > 0 && (
          <BulkActionsBar
            selectedPipelines={selectedFiles}
            onDeleteSuccess={() => {
              setSelectedIds(new Set());
              refetch();
            }}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </BlockStack>
    );
  },
  PipelineSectionSkeleton,
);

function ExamplePipelineButton() {
  return (
    <Button variant="secondary" asChild className="shrink-0">
      <Link to={APP_ROUTES.LEARN_EXAMPLES}>
        <Icon name="Sparkles" />
        Example Pipelines
      </Link>
    </Button>
  );
}
