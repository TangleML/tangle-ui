import { useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, useEffect, useState } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import QuickStartCards from "@/components/shared/QuickStart/QuickStartCards";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paragraph, Text } from "@/components/ui/typography";
import { QUICK_START_PATH } from "@/routes/router";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import BulkActionsBar from "./BulkActionsBar";
import PipelineRow from "./PipelineRow";

const DEFAULT_PAGE_SIZE = 10;

function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [currentPage, setCurrentPage] = useState(1);

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

  const resetPage = () => {
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
    resetPage,
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
  const [pipelines, setPipelines] = useState<Pipelines>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(
    new Set(),
  );

  const filteredPipelines = Array.from(pipelines.entries()).filter(([name]) => {
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

  const fetchUserPipelines = async () => {
    setIsLoading(true);
    try {
      const pipelines = await getAllComponentFilesFromList(
        USER_PIPELINES_LIST_NAME,
      );
      const sortedPipelines = new Map(
        [...pipelines.entries()].sort((a, b) => {
          return (
            new Date(b[1].modificationTime).getTime() -
            new Date(a[1].modificationTime).getTime()
          );
        }),
      );
      setPipelines(sortedPipelines);
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    resetPage();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allPipelineNames = new Set(filteredPipelines.map(([name]) => name));
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
    filteredPipelines.length > 0 &&
    filteredPipelines.every(([name]) => selectedPipelines.has(name));

  return (
    <BlockStack gap="4" className="w-full">
      <Alert variant="destructive">
        <Icon name="Terminal" />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          Your pipelines are stored in your browser&apos;s local storage.
          Clearing your browser data or cookies will delete all saved pipelines.
          Consider exporting important pipelines to files for backup.
        </AlertDescription>
      </Alert>

      <InlineStack
        gap="2"
        align="space-between"
        blockAlign="end"
        wrap="nowrap"
        className="w-full"
      >
        <BlockStack className="w-full">
          <Label className="mb-2">Search pipelines</Label>
          <InlineStack gap="1" wrap="nowrap">
            <Input type="text" value={searchQuery} onChange={handleSearch} />
            {!!searchQuery && (
              <Button variant="ghost" onClick={() => setSearchQuery("")}>
                <Icon name="CircleX" />
              </Button>
            )}
          </InlineStack>
        </BlockStack>

        <QuickStartButton />
      </InlineStack>

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
            {filteredPipelines.length === 0 && (
              <TableRow>No Pipelines found.</TableRow>
            )}
            {paginatedPipelines.map(([name, fileEntry]) => (
              <PipelineRow
                key={fileEntry.componentRef.digest}
                name={name}
                modificationTime={fileEntry.modificationTime}
                onDelete={fetchUserPipelines}
                isSelected={selectedPipelines.has(name)}
                onSelect={(checked) => handleSelectPipeline(name, checked)}
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
