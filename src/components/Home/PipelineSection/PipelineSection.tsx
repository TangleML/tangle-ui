import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import QuickStartCards from "@/components/shared/QuickStart/QuickStartCards";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  type HomeSearchParams,
  indexRoute,
  QUICK_START_PATH,
} from "@/routes/router";
import {
  fetchAllPipelineRunSummaries,
  type PipelineRunSummary,
} from "@/services/pipelineRunService";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import BulkActionsBar from "./BulkActionsBar";
import { PipelineFiltersBar } from "./PipelineFiltersBar";
import PipelineRow from "./PipelineRow";
import {
  DEFAULT_FILTERS,
  type PipelineFilters,
  usePipelineFilters,
} from "./usePipelineFilters";

const DEFAULT_PAGE_SIZE = 10;

function usePagination<T>(
  items: T[],
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey?: string,
) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when resetKey changes (e.g., when filters change)
  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const totalPages = Math.ceil(items.length / pageSize);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedItems = items.slice(startIndex, endIndex);

  const goToNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const goToPreviousPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
  };
}

type Pipelines = Map<string, ComponentFileEntry>;

const PipelineSectionSkeleton = () => {
  return (
    <BlockStack className="h-full" gap="3">
      <BlockStack>
        <InlineStack gap="2" align="space-between" className="w-full">
          <Skeleton size="lg" shape="button" />
          <Skeleton size="lg" shape="button" />
          <Skeleton size="lg" shape="button" />
        </InlineStack>
      </BlockStack>
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
};

export const PipelineSection = withSuspenseWrapper(() => {
  const navigate = useNavigate({ from: indexRoute.fullPath });
  const search = useSearch({ strict: false }) as Partial<HomeSearchParams>;

  // Convert URL search params to PipelineFilters
  const dateRange =
    search.from || search.to
      ? {
        from: search.from ? new Date(search.from) : undefined,
        to: search.to ? new Date(search.to) : undefined,
      }
      : undefined;

  const filtersFromUrl: PipelineFilters = {
    searchQuery: search.q ?? DEFAULT_FILTERS.searchQuery,
    sortField: search.sort ?? DEFAULT_FILTERS.sortField,
    sortDirection: search.dir ?? DEFAULT_FILTERS.sortDirection,
    dateRange,
    hasRunsOnly: search.hasRuns ?? DEFAULT_FILTERS.hasRunsOnly,
  };

  // Update URL when filters change
  const handleFiltersChange = (newFilters: PipelineFilters) => {
    navigate({
      search: (prev) => ({
        ...prev,
        q: newFilters.searchQuery || undefined,
        sort:
          newFilters.sortField !== DEFAULT_FILTERS.sortField
            ? newFilters.sortField
            : undefined,
        dir:
          newFilters.sortDirection !== DEFAULT_FILTERS.sortDirection
            ? newFilters.sortDirection
            : undefined,
        from: newFilters.dateRange?.from
          ? newFilters.dateRange.from.toISOString().split("T")[0]
          : undefined,
        to: newFilters.dateRange?.to
          ? newFilters.dateRange.to.toISOString().split("T")[0]
          : undefined,
        hasRuns: newFilters.hasRunsOnly || undefined,
      }),
    });
  };

  const [pipelines, setPipelines] = useState<Pipelines>(new Map());
  const [runSummaries, setRunSummaries] = useState<
    Map<string, PipelineRunSummary>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(
    new Set(),
  );

  const {
    filters,
    filterKey,
    filteredAndSortedPipelines,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    updateFilter,
  } = usePipelineFilters(pipelines, runSummaries, {
    filters: filtersFromUrl,
    onFiltersChange: handleFiltersChange,
  });

  const {
    paginatedItems: paginatedPipelines,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
  } = usePagination(filteredAndSortedPipelines, DEFAULT_PAGE_SIZE, filterKey);

  const fetchUserPipelines = async () => {
    setIsLoading(true);
    try {
      const [pipelinesData, summariesData] = await Promise.all([
        getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME),
        fetchAllPipelineRunSummaries(),
      ]);
      setPipelines(pipelinesData);
      setRunSummaries(summariesData);
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allPipelineNames = new Set(
        filteredAndSortedPipelines.map((p) => p.name),
      );
      setSelectedPipelines(allPipelineNames);
    } else {
      setSelectedPipelines(new Set());
    }
  };

  const handleSelectPipeline = (pipelineName: string, checked: boolean) => {
    const newSelected = new Set(selectedPipelines);
    if (checked) {
      newSelected.add(pipelineName);
    } else {
      newSelected.delete(pipelineName);
    }
    setSelectedPipelines(newSelected);
  };

  const handleBulkDelete = () => {
    setSelectedPipelines(new Set());
    fetchUserPipelines();
  };

  useEffect(() => {
    fetchUserPipelines();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Loading Pipelines" />;
  }

  if (pipelines.size === 0) {
    return (
      <BlockStack gap="4" align="center">
        <BlockStack gap="2">
          <Paragraph size="md" tone="subdued">
            You don&apos;t have any pipelines yet. Get started with a template
            below.
          </Paragraph>

          <QuickStartCards />
        </BlockStack>
        <BlockStack align="center" gap="2">
          <Text tone="subdued">Or start from scratch with</Text>
          <NewPipelineButton />
        </BlockStack>
      </BlockStack>
    );
  }

  const isAllSelected =
    filteredAndSortedPipelines.length > 0 &&
    filteredAndSortedPipelines.every((p) => selectedPipelines.has(p.name));

  return (
    <BlockStack gap="4" className="w-full">
      <PipelineFiltersBar
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onUpdateFilter={updateFilter}
        onClearFilters={clearFilters}
        totalCount={pipelines.size}
        filteredCount={filteredAndSortedPipelines.length}
      />

      <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <Icon name="Info" className="text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Pipelines are stored in your browser. Export important ones for backup.
        </AlertDescription>
      </Alert>

      {pipelines.size > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Modified at</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedPipelines.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <BlockStack gap="3" align="center">
                    <Icon
                      name="Search"
                      className="w-8 h-8 text-muted-foreground"
                    />
                    <Text tone="subdued">
                      No pipelines found matching your filters.
                    </Text>
                    <QuickStartButton />
                  </BlockStack>
                </TableCell>
              </TableRow>
            )}
            {paginatedPipelines.map((pipeline) => (
              <PipelineRow
                key={pipeline.fileEntry.componentRef.digest}
                name={pipeline.name}
                modificationTime={pipeline.fileEntry.modificationTime}
                onDelete={fetchUserPipelines}
                isSelected={selectedPipelines.has(pipeline.name)}
                onSelect={(checked) =>
                  handleSelectPipeline(pipeline.name, checked)
                }
              />
            ))}
          </TableBody>
        </Table>
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
              onClick={goToFirstPage}
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

      <Button onClick={fetchUserPipelines} className="mt-6 max-w-96">
        Refresh
      </Button>

      {selectedPipelines.size > 0 && (
        <BulkActionsBar
          selectedPipelines={Array.from(selectedPipelines)}
          onDeleteSuccess={handleBulkDelete}
          onClearSelection={() => setSelectedPipelines(new Set())}
        />
      )}
    </BlockStack>
  );
}, PipelineSectionSkeleton);

function QuickStartButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        navigate({ to: QUICK_START_PATH as string /* todo: fix this */ })
      }
    >
      <Icon name="Sparkles" />
      Example Pipelines
    </Button>
  );
}
