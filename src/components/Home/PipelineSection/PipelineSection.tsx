import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import { PaginationControls } from "@/components/shared/PaginationControls";
import QuickStartCards from "@/components/shared/QuickStart/QuickStartCards";
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
import { QUICK_START_PATH } from "@/routes/router";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

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
      filteredPipelines.length > 0 &&
      filteredPipelines.every(([name]) => selectedPipelines.has(name));

    return (
      <BlockStack gap="4" className="w-full">
        <PipelineFiltersBar
          filters={filterBarProps}
          actions={<QuickStartButton />}
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
            {paginatedPipelines.map(([name, fileEntry, matchMetadata]) => (
              <PipelineRow
                key={fileEntry.componentRef.digest}
                name={name}
                componentRef={fileEntry.componentRef}
                modificationTime={fileEntry.modificationTime}
                onDelete={fetchUserPipelines}
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

        <Button onClick={fetchUserPipelines} className="mt-6 max-w-96">
          Refresh
        </Button>

        {selectedPipelines.size > 0 && (
          <BulkActionsBar
            selectedPipelines={Array.from(selectedPipelines)}
            onDeleteSuccess={() => {
              setSelectedPipelines(new Set());
              fetchUserPipelines();
            }}
            onClearSelection={() => setSelectedPipelines(new Set())}
          />
        )}
      </BlockStack>
    );
  },
  PipelineSectionSkeleton,
);

function QuickStartButton() {
  return (
    <Button variant="secondary" asChild className="shrink-0">
      <Link to={QUICK_START_PATH as string}>
        <Icon name="Sparkles" />
        Example Pipelines
      </Link>
    </Button>
  );
}
