import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ExamplePipelines } from "@/components/Learn/ExamplePipelines";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import { PaginationControls } from "@/components/shared/PaginationControls";
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
import { deletePipeline } from "@/services/pipelineService";

import BulkActionsBar from "./BulkActionsBar";
import { PipelineFiltersBar } from "./PipelineFiltersBar";
import PipelineRow from "./PipelineRow";
import { usePipelineFilters } from "./usePipelineFilters";
import { type PipelineListEntry, usePipelineList } from "./usePipelineList";

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
    const { data, error, isPending, refetch } = usePipelineList();
    const pipelines = data?.pipelines ?? new Map<string, PipelineListEntry>();
    const loadError = error?.message ?? data?.error;
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

    const fetchUserPipelines = () => {
      void refetch();
    };

    const selectablePipelines = filteredPipelines.filter(
      ([, entry]) => entry.file?.canEdit !== false,
    );
    const selectedIds = [...selectedPipelines].filter((id) => {
      const entry = pipelines.get(id);
      return entry && entry.file?.canEdit !== false;
    });

    const handleSelectAll = (checked: boolean) => {
      setSelectedPipelines(
        checked ? new Set(selectablePipelines.map(([id]) => id)) : new Set(),
      );
    };

    const handleSelectPipeline = (name: string, checked: boolean) => {
      const next = new Set(selectedPipelines);
      if (checked) next.add(name);
      else next.delete(name);
      setSelectedPipelines(next);
    };

    if (isPending) return <LoadingScreen message="Loading Pipelines" />;

    if (pipelines.size === 0 && !loadError) {
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
      selectablePipelines.length > 0 &&
      selectablePipelines.every(([id]) => selectedPipelines.has(id));

    return (
      <BlockStack gap="4" className="w-full">
        {loadError && (
          <div role="alert" className="text-sm text-destructive">
            {loadError}
          </div>
        )}
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
                  aria-label="Select all pipelines"
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
            {paginatedPipelines.map(([id, fileEntry, matchMetadata]) => (
              <PipelineRow
                key={id}
                name={fileEntry.name}
                file={fileEntry.file}
                componentRef={fileEntry.componentRef}
                modificationTime={fileEntry.modificationTime}
                onDelete={fetchUserPipelines}
                isSelected={selectedPipelines.has(id)}
                onSelect={(checked) => handleSelectPipeline(id, checked)}
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

        <Button onClick={fetchUserPipelines} className="mt-6 max-w-96">
          Refresh
        </Button>

        {selectedIds.length > 0 && (
          <BulkActionsBar
            selectedPipelines={selectedIds}
            onDeletePipeline={async (id) => {
              const entry = pipelines.get(id);
              if (entry?.file) await entry.file.deleteFile();
              else if (entry) await deletePipeline(entry.name);
            }}
            onDeleteSuccess={() => {
              setSelectedPipelines(new Set());
            }}
            onDeleteSettled={fetchUserPipelines}
            onClearSelection={() => setSelectedPipelines(new Set())}
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
