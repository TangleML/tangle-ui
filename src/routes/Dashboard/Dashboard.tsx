import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type RefObject, useRef, useState } from "react";

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
import { APP_ROUTES, QUICK_START_PATH } from "@/routes/router";
import type { ComponentReference } from "@/utils/componentSpec";
import { getAllComponentFilesFromList } from "@/utils/componentStore";
import {
  USER_COMPONENTS_LIST_NAME,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

import { ComponentItem } from "./components/ComponentItem";
import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";
import { PipelineCard } from "./components/PipelineCard";
import { RunsTable } from "./components/RunsTable";
import { SectionToggleButton, StatCard } from "./components/StatCard";

const RECENT_PIPELINES_LIMIT = 8;
const COMPONENTS_PAGE_SIZE = 8;

const Dashboard = () => {
  const { backendUrl, configured, available } = useBackend();
  const navigate = useNavigate();
  const runsSectionRef = useRef<HTMLDivElement>(null);
  const pipelinesSectionRef = useRef<HTMLDivElement>(null);
  const componentsSectionRef = useRef<HTMLDivElement>(null);

  // -- Runs (with cursor pagination) -------------------------------------------
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [previousPageTokens, setPreviousPageTokens] = useState<string[]>([]);

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

  const handleNextPage = () => {
    if (runsData?.next_page_token) {
      setPreviousPageTokens((prev) => [...prev, pageToken ?? ""]);
      setPageToken(runsData.next_page_token);
    }
  };

  const handlePreviousPage = () => {
    const prev = previousPageTokens[previousPageTokens.length - 1];
    setPreviousPageTokens((tokens) => tokens.slice(0, -1));
    setPageToken(prev || undefined);
  };

  const handleFirstPage = () => {
    setPreviousPageTokens([]);
    setPageToken(undefined);
  };

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

  // -- UI state ---------------------------------------------------------------
  const [expandedComponentId, setExpandedComponentId] = useState<string | null>(
    null,
  );
  const [componentsPage, setComponentsPage] = useState(1);
  const [showRunsSection, setShowRunsSection] = useState(true);
  const [showComponentsSection, setShowComponentsSection] = useState(true);

  // -- Derived data ----------------------------------------------------------
  const allRuns = runsData?.pipeline_runs ?? [];
  const recentPipelines = pipelines.slice(0, RECENT_PIPELINES_LIMIT);
  const hasPagination =
    !!runsData?.next_page_token || previousPageTokens.length > 0;

  const totalPipelines = pipelines.length;
  const totalRuns = allRuns.length;
  const activeRuns = allRuns.filter((r) => {
    const s = getOverallExecutionStatusFromStats(
      r.execution_status_stats ?? undefined,
    );
    return s === "RUNNING" || s === "PENDING" || s === "QUEUED";
  }).length;
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
  const hasVisibleMainSections = showRunsSection || showComponentsSection;

  const viewAllPipelines = () =>
    navigate({ to: APP_ROUTES.HOME, search: { tab: "pipelines" } });

  const scrollToSection = (ref: RefObject<HTMLDivElement | null>): void => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <BlockStack gap="8" align="stretch">
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

          {/* Summary + section controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] sm:items-stretch">
            <StatCard
              label="Pipelines"
              value={totalPipelines}
              icon="Workflow"
              isLoading={isPipelinesLoading}
              onClick={() => scrollToSection(pipelinesSectionRef)}
            />
            <StatCard
              label="Active"
              value={activeRuns}
              icon="Activity"
              tone="warning"
              isLoading={isRunsLoading}
              onClick={() => scrollToSection(runsSectionRef)}
            />
            <InlineStack
              align="center"
              blockAlign="center"
              className="hidden px-1 text-muted-foreground sm:flex"
            >
              <Text as="span" size="xl" font="mono">
                ::
              </Text>
            </InlineStack>
            <SectionToggleButton
              label="Runs"
              count={totalRuns}
              isActive={showRunsSection}
              onToggle={() => setShowRunsSection((previous) => !previous)}
            />
            <SectionToggleButton
              label="Components"
              count={totalComponents}
              isActive={showComponentsSection}
              onToggle={() => setShowComponentsSection((previous) => !previous)}
            />
          </div>
        </BlockStack>

        {/* Runs + Components (toggleable, responsive split) */}
        {hasVisibleMainSections && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
            {showRunsSection && (
              <div
                ref={runsSectionRef}
                className={cn(
                  "lg:col-span-10",
                  showComponentsSection && "lg:col-span-7",
                )}
              >
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
                      <RunsTable runs={allRuns} />
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
                            onClick={handleNextPage}
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
            )}

            {showComponentsSection && (
              <div
                ref={componentsSectionRef}
                className={cn(
                  "lg:col-span-10",
                  showRunsSection && "lg:col-span-3",
                )}
              >
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
                        <InlineStack
                          gap="2"
                          align="space-between"
                          blockAlign="center"
                        >
                          <Text as="span" size="xs" tone="subdued">
                            Page {currentComponentsPage} of{" "}
                            {totalComponentPages}
                          </Text>
                          <InlineStack gap="2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setComponentsPage((page) =>
                                  Math.max(1, page - 1),
                                )
                              }
                              disabled={currentComponentsPage === 1}
                            >
                              <Icon name="ChevronLeft" size="sm" />
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setComponentsPage((page) =>
                                  Math.min(totalComponentPages, page + 1),
                                )
                              }
                              disabled={
                                currentComponentsPage === totalComponentPages
                              }
                            >
                              Next
                              <Icon name="ChevronRight" size="sm" />
                            </Button>
                          </InlineStack>
                        </InlineStack>
                      )}
                    </>
                  )}
                </DashboardSection>
              </div>
            )}
          </div>
        )}

        {/* My Pipelines — full width */}
        <div ref={pipelinesSectionRef}>
          <DashboardSection
            title="My Pipelines"
            count={totalPipelines}
            actionLabel="View all"
            onAction={viewAllPipelines}
          >
            {isPipelinesLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : recentPipelines.length === 0 ? (
              <EmptyState
                icon="Workflow"
                message="No pipelines yet. Create one or start from a template."
              >
                <InlineStack gap="2">
                  <NewPipelineButton />
                  <Button variant="secondary" asChild>
                    <Link to={QUICK_START_PATH as string}>
                      <Icon name="Sparkles" size="sm" />
                      Templates
                    </Link>
                  </Button>
                </InlineStack>
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentPipelines.map(({ name, entry }) => (
                  <PipelineCard key={name} name={name} entry={entry} />
                ))}
              </div>
            )}
          </DashboardSection>
        </div>
      </BlockStack>
    </div>
  );
};

export default Dashboard;
