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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paragraph, Text } from "@/components/ui/typography";
import { usePagination } from "@/hooks/usePagination";
import { APP_ROUTES } from "@/routes/router";
import { deletePipeline } from "@/services/pipelineService";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import BulkActionsBar from "./BulkActionsBar";
import { PipelineFiltersBar } from "./PipelineFiltersBar";
import PipelineRow from "./PipelineRow";
import { type PipelineEntry, usePipelineFilters } from "./usePipelineFilters";
import { type PipelineListEntry, usePipelineList } from "./usePipelineList";
import { useRemotePipelineList } from "./useRemotePipelineList";

const DEFAULT_PAGE_SIZE = 10;

const PipelineSectionSkeleton = () => (
  <BlockStack className="h-full" gap="3">
    <InlineStack gap="2" align="space-between" className="w-full">
      <Skeleton size="lg" shape="button" />
      <Skeleton size="lg" shape="button" />
    </InlineStack>
    <Skeleton size="full" />
  </BlockStack>
);

interface PipelineSectionProps {
  onPipelineClick?: (name: string) => void;
}

export const PipelineSection = withSuspenseWrapper(
  ({ onPipelineClick }: PipelineSectionProps) => {
    const storage = usePipelineStorage();
    return (
      <PipelineLists key={storage.scope} onPipelineClick={onPipelineClick} />
    );
  },
  PipelineSectionSkeleton,
);

function PipelineLists({ onPipelineClick }: PipelineSectionProps) {
  const storage = usePipelineStorage();
  const local = usePipelineList();
  if (!storage.remoteEnabled)
    return (
      <LocalPipelineList query={local} onPipelineClick={onPipelineClick} />
    );
  return <PipelineTabs local={local} onPipelineClick={onPipelineClick} />;
}

function PipelineTabs({
  local,
  onPipelineClick,
}: PipelineSectionProps & { local: ReturnType<typeof usePipelineList> }) {
  const remote = useRemotePipelineList();
  const [chosenTab, setChosenTab] = useState<"remote" | "local" | null>(null);
  const localCount = local.data?.pipelines.size ?? 0;
  const defaultTab =
    remote.hasRemotePipelines === false && localCount > 0 ? "local" : "remote";
  const activeTab = chosenTab ?? defaultTab;
  return (
    <Tabs
      value={activeTab}
      onValueChange={(tab) => {
        if (tab === "remote" || tab === "local") setChosenTab(tab);
      }}
      className="w-full min-w-0 gap-5"
    >
      <TabsList aria-label="Pipeline storage">
        <TabsTrigger
          value="remote"
          className="gap-2 px-4"
          onClick={() => setChosenTab("remote")}
        >
          <Icon name="Cloud" />
          Remote pipelines
          {remote.hasRemotePipelines !== undefined && (
            <Text size="xs" tone="subdued" className="tabular-nums">
              {remote.totalCount}
            </Text>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="local"
          className="gap-2 px-4"
          onClick={() => setChosenTab("local")}
        >
          <Icon name="HardDrive" />
          Local pipelines
          {local.data && (
            <Text size="xs" tone="subdued" className="tabular-nums">
              {localCount}
            </Text>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="remote"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <BlockStack gap="4">
          <PipelineFiltersBar
            remote
            filters={remote.filterBarProps}
            actions={<ExamplePipelineButton />}
          />
          {remote.error && (
            <Paragraph role="alert" size="sm" className="text-destructive">
              Could not load remote pipelines: {remote.error}
            </Paragraph>
          )}
          {remote.showingCached && (
            <Paragraph size="sm" tone="subdued">
              Showing pipelines cached in this browser. The server list may be
              incomplete.
            </Paragraph>
          )}
          {remote.isPending ? (
            <LoadingScreen message="Loading remote pipelines" />
          ) : (
            <>
              <PipelineListTable
                key={`remote:${activeTab}:${remote.pagination.currentPage}:${remote.filterKey}`}
                rows={remote.rows}
                selectableRows={remote.rows}
                remote
                emptyMessage={
                  remote.error && remote.totalCount === 0
                    ? "No cached remote pipelines are available."
                    : remote.filterBarProps.hasActiveFilters
                      ? "No remote pipelines match these filters."
                      : "No remote pipelines yet. Create a pipeline or save one from Local pipelines."
                }
                onRefresh={() => void remote.refresh()}
                onPipelineClick={onPipelineClick}
              />
              <PaginationControls
                currentPage={remote.pagination.currentPage}
                totalPages={remote.pagination.totalPages}
                hasNextPage={remote.pagination.hasNextPage}
                hasPreviousPage={remote.pagination.hasPreviousPage}
                onNextPage={() => void remote.pagination.goToNextPage()}
                onPreviousPage={remote.pagination.goToPreviousPage}
                onReset={remote.pagination.resetPage}
              />
            </>
          )}
          <Button
            onClick={() => void remote.refresh()}
            disabled={remote.isFetching}
            className="mt-6 max-w-96"
          >
            Refresh
          </Button>
        </BlockStack>
      </TabsContent>
      <TabsContent
        value="local"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <LocalPipelineList
          query={local}
          onPipelineClick={onPipelineClick}
          selectionScope={activeTab}
          remoteEnabled
        />
      </TabsContent>
    </Tabs>
  );
}

function LocalPipelineList({
  query,
  onPipelineClick,
  selectionScope = "local",
  remoteEnabled = false,
}: PipelineSectionProps & {
  query: ReturnType<typeof usePipelineList>;
  selectionScope?: string;
  remoteEnabled?: boolean;
}) {
  const pipelines =
    query.data?.pipelines ?? new Map<string, PipelineListEntry>();
  const loadError = query.error?.message ?? query.data?.error;
  const { filteredPipelines, filterBarProps, filterKey } =
    usePipelineFilters(pipelines);
  const pagination = usePagination(
    filteredPipelines,
    DEFAULT_PAGE_SIZE,
    filterKey,
  );
  const refresh = () => {
    void query.refetch();
  };
  if (query.isPending)
    return <LoadingScreen message="Loading local pipelines" />;
  if (!remoteEnabled && pipelines.size === 0 && !loadError)
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
  return (
    <BlockStack gap="4" className="w-full">
      {loadError && (
        <Paragraph role="alert" size="sm" className="text-destructive">
          {loadError}
        </Paragraph>
      )}
      <PipelineFiltersBar
        filters={filterBarProps}
        actions={<ExamplePipelineButton />}
      />
      <PipelineListTable
        key={`local:${selectionScope}:${filterKey}`}
        rows={pagination.paginatedItems}
        selectableRows={filteredPipelines}
        emptyMessage={
          filterBarProps.hasActiveFilters
            ? "No pipelines found."
            : "No local pipelines. Pipelines saved to the server appear in Remote pipelines."
        }
        onRefresh={refresh}
        onPipelineClick={onPipelineClick}
      />
      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        hasNextPage={pagination.hasNextPage}
        hasPreviousPage={pagination.hasPreviousPage}
        onNextPage={pagination.goToNextPage}
        onPreviousPage={pagination.goToPreviousPage}
        onReset={pagination.resetPage}
      />
      <Button
        onClick={refresh}
        disabled={query.isFetching}
        className="mt-6 max-w-96"
      >
        Refresh
      </Button>
    </BlockStack>
  );
}

function PipelineListTable({
  rows,
  selectableRows,
  remote = false,
  emptyMessage,
  onRefresh,
  onPipelineClick,
}: PipelineSectionProps & {
  rows: PipelineEntry<PipelineListEntry>[];
  selectableRows: PipelineEntry<PipelineListEntry>[];
  remote?: boolean;
  emptyMessage: string;
  onRefresh: () => void;
}) {
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(
    new Set(),
  );
  const selectable = selectableRows.filter(
    ([, entry]) => entry.file?.canEdit !== false,
  );
  const selectedIds = selectable
    .filter(([id]) => selectedPipelines.has(id))
    .map(([id]) => id);
  const isAllSelected =
    selectable.length > 0 &&
    selectable.every(([id]) => selectedPipelines.has(id));
  return (
    <>
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="w-10">
              <Checkbox
                checked={isAllSelected}
                aria-label={
                  remote
                    ? "Select pipelines on this page"
                    : "Select all pipelines"
                }
                onCheckedChange={(checked) =>
                  setSelectedPipelines(
                    checked ? new Set(selectable.map(([id]) => id)) : new Set(),
                  )
                }
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Modified at</TableHead>
            {!remote && <TableHead>Tags</TableHead>}
            {!remote && <TableHead>Last run</TableHead>}
            <TableHead>Runs</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={remote ? 5 : 7}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {rows.map(([id, entry, match]) => (
            <PipelineRow
              key={id}
              name={entry.name}
              file={entry.file}
              componentRef={entry.componentRef}
              showLocalColumns={!remote}
              modificationTime={entry.modificationTime}
              onDelete={onRefresh}
              isSelected={selectedPipelines.has(id)}
              onSelect={(checked) =>
                setSelectedPipelines((previous) => {
                  const next = new Set(previous);
                  if (checked) next.add(id);
                  else next.delete(id);
                  return next;
                })
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
      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedPipelines={selectedIds}
          onDeletePipeline={async (id) => {
            const entry = selectable.find(([entryId]) => entryId === id)?.[1];
            if (entry?.file) await entry.file.deleteFile();
            else if (entry) await deletePipeline(entry.name);
          }}
          onDeleteSuccess={() => setSelectedPipelines(new Set())}
          onDeleteSettled={onRefresh}
          onClearSelection={() => setSelectedPipelines(new Set())}
        />
      )}
    </>
  );
}

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
