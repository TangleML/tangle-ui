import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type DragEvent,
  Fragment,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import type { ListPipelineJobsResponse } from "@/api/types.gen";
import ImportPipeline from "@/components/shared/ImportPipeline";
import NewPipelineButton from "@/components/shared/NewPipelineButton";
import { PipelineRunFiltersBar } from "@/components/shared/PipelineRunFiltersBar/PipelineRunFiltersBar";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { EDITOR_PATH, QUICK_START_PATH } from "@/routes/router";
import type { ComponentReference } from "@/utils/componentSpec";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import {
  USER_COMPONENTS_LIST_NAME,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import { getRecentPipelines } from "@/utils/recentPipelines";
import { getRecentRuns } from "@/utils/recentRuns";

import { ComponentItem } from "./components/ComponentItem";
import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";
import { PaginationControls } from "./components/PaginationControls";
import { PipelineCard } from "./components/PipelineCard";
import { RecentItemLink } from "./components/RecentItemLink";
import { RunsTable } from "./components/RunsTable";
import { SectionToggleButton, StatCard } from "./components/StatCard";
import { useCursorPagination } from "./hooks/useCursorPagination";
import { usePinnedLinks } from "./hooks/usePinnedLinks";
import { useSectionOrder } from "./hooks/useSectionOrder";
import { recentItemKey, type RecentLinkItem } from "./types";

const RECENT_RUN_LINKS_LIMIT = 2;
const RECENT_PIPELINE_LINKS_LIMIT = 2;
const RECENT_OPENED_VISIBLE_LIMIT = 4;
const COMPONENTS_PAGE_SIZE = 8;
const PIPELINES_PAGE_SIZE = 9;

type PipelineGridColumns = 1 | 2 | 3;

function getTopSectionColClass(
  sectionId: string,
  topSections: string[],
): string {
  if (topSections.length <= 1) return "lg:col-span-10";
  if (topSections.includes("runs")) {
    return sectionId === "runs" ? "lg:col-span-7" : "lg:col-span-3";
  }
  return "lg:col-span-5";
}

const Dashboard = () => {
  const { backendUrl, configured, available } = useBackend();
  const runsSectionRef = useRef<HTMLDivElement>(null);
  const pipelinesSectionRef = useRef<HTMLDivElement>(null);

  // -- Runs (with cursor pagination) -------------------------------------------
  const {
    pageToken,
    previousPageTokens,
    handleNextPage,
    handlePreviousPage,
    handleFirstPage,
  } = useCursorPagination();

  const {
    data: runsData,
    isLoading: isRunsLoading,
    isFetching: isRunsFetching,
  } = useQuery<ListPipelineJobsResponse>({
    queryKey: ["dashboard-runs", backendUrl, pageToken],
    refetchOnWindowFocus: false,
    enabled: configured && available,
    queryFn: async () => {
      const u = new URL("/api/pipeline_runs/", backendUrl);
      u.searchParams.set("include_pipeline_names", "true");
      u.searchParams.set("include_execution_stats", "true");
      if (pageToken) u.searchParams.set("page_token", pageToken);
      return fetchWithErrorHandling(u.toString());
    },
  });

  // -- Pipelines (local IndexedDB) ---------------------------------------------
  const { data: pipelines = [], isLoading: isPipelinesLoading } = useQuery({
    queryKey: ["dashboard-pipelines"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const map = await getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME);
      return [...map.entries()]
        .sort(
          (a, b) =>
            new Date(b[1].modificationTime).getTime() -
            new Date(a[1].modificationTime).getTime(),
        )
        .map(([name, entry]) => ({ name, entry }));
    },
  });

  // -- User components (local IndexedDB) --------------------------------------
  const { data: userComponents = [], isLoading: isUserComponentsLoading } =
    useQuery({
      queryKey: ["dashboard-user-components"],
      refetchOnWindowFocus: false,
      queryFn: async () => {
        const map = await getAllComponentFilesFromList(
          USER_COMPONENTS_LIST_NAME,
        );
        return [...map.entries()].map<ComponentReference>(([, fileEntry]) => ({
          ...fileEntry.componentRef,
          name: fileEntry.name,
          owned: true,
        }));
      },
    });

  const isFiltersBarEnabled = useFlagValue("pipeline-run-filters-bar");
  const showRecentlyOpenedSection = useFlagValue(
    "dashboard-show-recently-opened",
  );
  const showPinnedSection = useFlagValue("dashboard-show-pinned");

  // -- Section ordering & visibility ------------------------------------------
  const {
    sectionOrder,
    sectionVisibility,
    draggingSectionId,
    dragOverSectionId,
    visibleSections,
    toggleSectionVisibility,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDrop,
    handleSectionDragEnd,
  } = useSectionOrder();

  // -- Pinned items -----------------------------------------------------------
  const pipelineNames = new Set(pipelines.map((p) => p.name));

  const {
    pinnedItems,
    pinnedUrls,
    pinnedRunUrls,
    handleToggleRunPinned,
    handleTogglePipelinePinned,
    handleTogglePinnedLink,
  } = usePinnedLinks(pipelineNames);

  // -- UI state ---------------------------------------------------------------
  const [expandedComponentId, setExpandedComponentId] = useState<string | null>(
    null,
  );
  const [componentsPage, setComponentsPage] = useState(1);
  const [pipelinesPage, setPipelinesPage] = useState(1);
  const [pipelineGridColumns, setPipelineGridColumns] =
    useState<PipelineGridColumns>(3);
  const [showAllRecentlyOpened, setShowAllRecentlyOpened] = useState(false);

  // -- Derived data -----------------------------------------------------------
  const allRuns = runsData?.pipeline_runs ?? [];

  const pipelineItemsForSection: { name: string; entry: ComponentFileEntry }[] =
    pipelines.map(({ name, entry }) => ({ name, entry }));

  const recentRunLinks: RecentLinkItem[] = getRecentRuns()
    .slice(0, RECENT_RUN_LINKS_LIMIT)
    .map((run) => ({ ...run, type: "run" }));
  const recentPipelineLinks: RecentLinkItem[] = getRecentPipelines()
    .filter((pipeline) => pipelineNames.has(pipeline.title))
    .slice(0, RECENT_PIPELINE_LINKS_LIMIT)
    .map((pipeline) => ({ ...pipeline, type: "pipeline" }));
  const recentlyOpened = [...recentRunLinks, ...recentPipelineLinks];

  const hasRecentlyOpened = recentlyOpened.length > 0;
  const visibleRecentlyOpened = showAllRecentlyOpened
    ? recentlyOpened
    : recentlyOpened.slice(0, RECENT_OPENED_VISIBLE_LIMIT);
  const hiddenRecentlyOpenedCount = Math.max(
    0,
    recentlyOpened.length - visibleRecentlyOpened.length,
  );

  const hasPinnedItems = pinnedItems.length > 0;
  const hasVisiblePinnedFeed = showPinnedSection && hasPinnedItems;
  const hasVisibleRecentFeed = showRecentlyOpenedSection && hasRecentlyOpened;
  const hasPagination =
    !!runsData?.next_page_token || previousPageTokens.length > 0;

  const totalRuns = allRuns.length;
  const activeRuns = allRuns.filter((r) => {
    const s = getOverallExecutionStatusFromStats(
      r.execution_status_stats ?? undefined,
    );
    return s === "RUNNING" || s === "PENDING" || s === "QUEUED";
  }).length;
  const errorRuns = allRuns.filter((r) => {
    const s = getOverallExecutionStatusFromStats(
      r.execution_status_stats ?? undefined,
    );
    return s === "FAILED" || s === "SYSTEM_ERROR" || s === "INVALID";
  }).length;

  const totalPipelines = pipelines.length;
  const totalPipelinePages = Math.max(
    1,
    Math.ceil(totalPipelines / PIPELINES_PAGE_SIZE),
  );
  const currentPipelinesPage = Math.min(pipelinesPage, totalPipelinePages);
  const paginatedPipelineItems = pipelineItemsForSection.slice(
    (currentPipelinesPage - 1) * PIPELINES_PAGE_SIZE,
    currentPipelinesPage * PIPELINES_PAGE_SIZE,
  );

  const totalComponents = userComponents.length;
  const totalComponentPages = Math.max(
    1,
    Math.ceil(totalComponents / COMPONENTS_PAGE_SIZE),
  );
  const currentComponentsPage = Math.min(componentsPage, totalComponentPages);
  const paginatedUserComponents = userComponents.slice(
    (currentComponentsPage - 1) * COMPONENTS_PAGE_SIZE,
    currentComponentsPage * COMPONENTS_PAGE_SIZE,
  );

  const topVisibleSections = visibleSections.slice(0, 2);
  const lowerVisibleSections = visibleSections.slice(2);
  const hasVisibleSections = visibleSections.length > 0;
  const pipelineGridColumnsClass =
    pipelineGridColumns === 1
      ? "grid-cols-1"
      : pipelineGridColumns === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  const sectionMeta = {
    runs: { label: "Runs", count: totalRuns },
    components: { label: "Components", count: totalComponents },
    pipelines: { label: "Pipelines", count: totalPipelines },
  };

  // -- Effects ----------------------------------------------------------------
  const scrollToSection = (ref: RefObject<HTMLDivElement | null>): void => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!sectionVisibility.pipelines) return;

    const element = pipelinesSectionRef.current;
    if (!element) return;

    const updateColumnsFromWidth = (width: number) => {
      if (width < 520) {
        setPipelineGridColumns(1);
        return;
      }

      if (width < 920) {
        setPipelineGridColumns(2);
        return;
      }

      setPipelineGridColumns(3);
    };

    updateColumnsFromWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const firstEntry = entries[0];
      if (!firstEntry) return;
      updateColumnsFromWidth(firstEntry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [sectionOrder, sectionVisibility.pipelines]);

  // -- Section renderers ------------------------------------------------------
  const renderSection = (sectionId: string, className?: string): ReactNode => {
    if (sectionId === "runs") {
      return (
        <div ref={runsSectionRef} className={className}>
          <DashboardSection title="All Runs" count={totalRuns}>
            {isFiltersBarEnabled && <PipelineRunFiltersBar />}
            {isRunsLoading || isRunsFetching ? (
              <BlockStack gap="2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </BlockStack>
            ) : !configured || !available ? (
              <EmptyState
                icon="CloudOff"
                message={
                  !configured
                    ? "Configure a backend to see your runs"
                    : "Backend is currently unavailable"
                }
              />
            ) : allRuns.length === 0 ? (
              <EmptyState
                icon="Play"
                message="No runs yet. Execute a pipeline to see results here."
              />
            ) : (
              <>
                <RunsTable
                  runs={allRuns}
                  showPinControls={showPinnedSection}
                  pinnedRunUrls={pinnedRunUrls}
                  onToggleRunPinned={handleToggleRunPinned}
                />
                {hasPagination && (
                  <InlineStack
                    gap="2"
                    align="space-between"
                    blockAlign="center"
                  >
                    <InlineStack gap="2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFirstPage}
                        disabled={!pageToken}
                      >
                        <Icon name="ChevronsLeft" size="sm" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={previousPageTokens.length === 0}
                      >
                        <Icon name="ChevronLeft" size="sm" />
                        Previous
                      </Button>
                    </InlineStack>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleNextPage(runsData?.next_page_token ?? undefined)
                      }
                      disabled={!runsData?.next_page_token}
                    >
                      Next
                      <Icon name="ChevronRight" size="sm" />
                    </Button>
                  </InlineStack>
                )}
              </>
            )}
          </DashboardSection>
        </div>
      );
    }

    if (sectionId === "components") {
      return (
        <div className={className}>
          <DashboardSection title="My Components" count={totalComponents}>
            {isUserComponentsLoading ? (
              <BlockStack gap="2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </BlockStack>
            ) : userComponents.length === 0 ? (
              <EmptyState
                icon="Box"
                message="No components yet. Create custom components in the pipeline editor."
              />
            ) : (
              <>
                <BlockStack gap="1">
                  {paginatedUserComponents.map((c, i) => {
                    const id =
                      c.digest ??
                      `user-${(currentComponentsPage - 1) * COMPONENTS_PAGE_SIZE + i}`;
                    return (
                      <ComponentItem
                        key={id}
                        component={c}
                        isExpanded={expandedComponentId === id}
                        onToggle={() =>
                          setExpandedComponentId(
                            expandedComponentId === id ? null : id,
                          )
                        }
                      />
                    );
                  })}
                </BlockStack>
                {totalComponentPages > 1 && (
                  <PaginationControls
                    currentPage={currentComponentsPage}
                    totalPages={totalComponentPages}
                    onPreviousPage={() =>
                      setComponentsPage((page) => Math.max(1, page - 1))
                    }
                    onNextPage={() =>
                      setComponentsPage((page) =>
                        Math.min(totalComponentPages, page + 1),
                      )
                    }
                  />
                )}
              </>
            )}
          </DashboardSection>
        </div>
      );
    }

    return (
      <div ref={pipelinesSectionRef} className={className}>
        <DashboardSection title="My Pipelines" count={totalPipelines}>
          {isPipelinesLoading ? (
            <div className={cn("grid gap-3", pipelineGridColumnsClass)}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : pipelineItemsForSection.length === 0 ? (
            <EmptyState
              icon="Workflow"
              message="No pipelines yet. Create one or start from a template."
            >
              <InlineStack gap="2">
                <NewPipelineButton />
                {/* Widen to `string` because TanStack Router's `to` expects
                    registered route literals, but QUICK_START_PATH is a plain
                    constant. */}
                <Button variant="secondary" asChild>
                  <Link to={QUICK_START_PATH as string}>
                    <Icon name="Sparkles" size="sm" />
                    Templates
                  </Link>
                </Button>
              </InlineStack>
            </EmptyState>
          ) : (
            <BlockStack gap="2">
              <div className={cn("grid gap-2", pipelineGridColumnsClass)}>
                {paginatedPipelineItems.map(({ name, entry }) => (
                  <PipelineCard
                    key={name}
                    name={name}
                    entry={entry}
                    showPinControls={showPinnedSection}
                    pinned={pinnedUrls.has(
                      `${EDITOR_PATH}/${encodeURIComponent(name)}`,
                    )}
                    onTogglePinned={handleTogglePipelinePinned}
                  />
                ))}
              </div>
              {totalPipelinePages > 1 && (
                <PaginationControls
                  currentPage={currentPipelinesPage}
                  totalPages={totalPipelinePages}
                  onPreviousPage={() =>
                    setPipelinesPage((page) => Math.max(1, page - 1))
                  }
                  onNextPage={() =>
                    setPipelinesPage((page) =>
                      Math.min(totalPipelinePages, page + 1),
                    )
                  }
                />
              )}
            </BlockStack>
          )}
        </DashboardSection>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <BlockStack gap="4" align="stretch">
        {/* Header */}
        <BlockStack gap="4">
          <InlineStack
            gap="4"
            align="space-between"
            blockAlign="end"
            wrap="nowrap"
          >
            <BlockStack gap="0">
              <Text as="h1" size="2xl" weight="bold">
                Command Center
              </Text>
              <Text as="p" size="sm" tone="subdued">
                Your ML workspace at a glance
              </Text>
            </BlockStack>

            <InlineStack gap="2" wrap="nowrap">
              {/* Widen to `string` — see comment above about TanStack Router. */}
              <Button variant="secondary" asChild>
                <Link to={QUICK_START_PATH as string}>
                  <Icon name="Sparkles" size="sm" />
                  Templates
                </Link>
              </Button>
              <ImportPipeline
                triggerComponent={
                  <Button variant="secondary">
                    <Icon name="Upload" size="sm" />
                    Import
                  </Button>
                }
              />
            </InlineStack>
          </InlineStack>

          <Separator />

          {/* Recently opened */}
          {hasVisibleRecentFeed && (
            <BlockStack gap="2">
              <Text as="p" size="xs" tone="subdued" weight="semibold">
                Recently opened
              </Text>
              <InlineStack gap="2" wrap="wrap">
                {visibleRecentlyOpened.map((item) => (
                  <RecentItemLink
                    key={recentItemKey(item)}
                    item={item}
                    isPinned={pinnedUrls.has(item.url)}
                    onTogglePinned={handleTogglePinnedLink}
                    showPinControls={showPinnedSection}
                  />
                ))}
                {hiddenRecentlyOpenedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-border/50 bg-transparent px-3 text-xs"
                    onClick={() => setShowAllRecentlyOpened(true)}
                  >
                    +{hiddenRecentlyOpenedCount} more
                  </Button>
                )}
                {showAllRecentlyOpened &&
                  recentlyOpened.length > RECENT_OPENED_VISIBLE_LIMIT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg px-3 text-xs text-muted-foreground"
                      onClick={() => setShowAllRecentlyOpened(false)}
                    >
                      Show less
                    </Button>
                  )}
              </InlineStack>
            </BlockStack>
          )}

          {/* Pinned */}
          {hasVisiblePinnedFeed && (
            <BlockStack gap="2">
              <Text as="p" size="xs" tone="subdued" weight="semibold">
                Pinned
              </Text>
              <InlineStack gap="2" wrap="wrap">
                {pinnedItems.map((item) => (
                  <RecentItemLink
                    key={`pinned-${recentItemKey(item)}`}
                    item={item}
                    isPinned={true}
                    onTogglePinned={handleTogglePinnedLink}
                    showPinControls={showPinnedSection}
                  />
                ))}
              </InlineStack>
            </BlockStack>
          )}

          {/* Summary + section controls */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] xl:items-start">
            <StatCard
              label="Active"
              value={activeRuns}
              icon="Activity"
              tone="warning"
              isLoading={isRunsLoading}
              onClick={() => scrollToSection(runsSectionRef)}
            />
            <StatCard
              label="Errors"
              value={errorRuns}
              icon="TriangleAlert"
              tone="critical"
              isLoading={isRunsLoading}
              onClick={() => scrollToSection(runsSectionRef)}
            />
            <InlineStack
              align="center"
              blockAlign="center"
              className="relative hidden min-h-18 px-2 xl:flex"
            >
              <div className="pointer-events-none h-2.5 w-2.5 rotate-45 rounded-[2px] border border-border/70 bg-muted/35" />
            </InlineStack>
            {sectionOrder.map((sectionId) => (
              <div key={sectionId} className="relative">
                <div
                  draggable
                  onDragStart={() => handleSectionDragStart(sectionId)}
                  onDragOver={(event: DragEvent<HTMLDivElement>) =>
                    handleSectionDragOver(event, sectionId)
                  }
                  onDrop={() => handleSectionDrop(sectionId)}
                  onDragEnd={handleSectionDragEnd}
                  className={cn(
                    "w-full cursor-grab rounded-xl transition-all active:cursor-grabbing",
                    draggingSectionId === sectionId &&
                      "scale-[1.01] opacity-85 shadow-lg ring-2 ring-violet-500/40",
                    dragOverSectionId === sectionId &&
                      "ring-2 ring-violet-500/60 ring-offset-2",
                  )}
                >
                  <SectionToggleButton
                    label={sectionMeta[sectionId].label}
                    count={sectionMeta[sectionId].count}
                    isActive={sectionVisibility[sectionId]}
                    onToggle={() => toggleSectionVisibility(sectionId)}
                    showVisibilityIcon={false}
                  />
                </div>
                <div className="pointer-events-none absolute right-3 top-3 text-muted-foreground/75">
                  <Icon name="GripVertical" size="xs" />
                </div>
              </div>
            ))}
          </div>
        </BlockStack>

        {hasVisibleSections && (
          <BlockStack gap="3">
            {topVisibleSections.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
                {topVisibleSections.map((sectionId) => (
                  <Fragment key={`top-${sectionId}`}>
                    {renderSection(
                      sectionId,
                      cn(
                        "lg:col-span-10",
                        getTopSectionColClass(sectionId, topVisibleSections),
                      ),
                    )}
                  </Fragment>
                ))}
              </div>
            )}

            {lowerVisibleSections.map((sectionId) => (
              <div key={`lower-${sectionId}`}>{renderSection(sectionId)}</div>
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </div>
  );
};

export default Dashboard;
