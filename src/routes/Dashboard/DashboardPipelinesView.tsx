import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useLocalPipelineNames } from "@/services/localPipelines/useLocalPipelines";

import { FavoritesPreview } from "./FavoritesPreview";
import {
  hasRemotePipelineFilters,
  type RemotePipelineSearchFilters,
  validatePipelinesSearch,
} from "./pipelinesSearch";
import { RemotePipelinesTable } from "./RemotePipelinesTable";

export function DashboardPipelinesView() {
  const navigate = useNavigate();
  const search = validatePipelinesSearch(useSearch({ strict: false }));
  const { ready, configured } = useBackend();
  const {
    data: localNames,
    isPending,
    error,
    refetch,
  } = useLocalPipelineNames();
  const localBuild = import.meta.env.VITE_LOCAL_PIPELINES === "true";
  const localOnly = localBuild || !configured;
  const hasLocalPipelines = localNames?.length !== 0;
  const showTabs = !localOnly && hasLocalPipelines;
  const isLoading = !localBuild && (!ready || (!localOnly && isPending));
  const hasFilters = hasRemotePipelineFilters(search);
  const tab = localOnly
    ? "local"
    : !hasLocalPipelines
      ? "remote"
      : (search.tab ?? (hasFilters ? "remote" : "local"));

  function changeFilters(filters: RemotePipelineSearchFilters) {
    void navigate({
      to: APP_ROUTES.DASHBOARD_PIPELINES,
      search: (previous) => ({
        ...validatePipelinesSearch(previous),
        ...filters,
        tab: "remote",
      }),
      resetScroll: false,
      replace: true,
    });
  }

  const examples = (
    <Button variant="secondary" asChild>
      <Link to={APP_ROUTES.LEARN_EXAMPLES}>
        <Icon name="Sparkles" />
        Example Pipelines
      </Link>
    </Button>
  );
  const remotePipelines = (
    <RemotePipelinesTable filters={search} onFiltersChange={changeFilters} />
  );

  return (
    <BlockStack gap="6">
      <FavoritesPreview
        title="Favorite Pipelines"
        typeFilter="pipeline"
        hideWhenEmpty
        trackingId="pipelines.favorites.item"
      />
      <BlockStack gap="4">
        <Heading level={2}>Pipelines</Heading>
        {isLoading ? (
          <LoadingScreen message="Loading pipelines…" />
        ) : (
          <>
            {error && (
              <InlineStack gap="3">
                <Paragraph role="alert">
                  Unable to load the local pipeline list.
                </Paragraph>
                <Button variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </InlineStack>
            )}
            {showTabs ? (
              <Tabs
                value={tab}
                onValueChange={(tab) => {
                  if (tab !== "local" && tab !== "remote") return;
                  void navigate({
                    to: APP_ROUTES.DASHBOARD_PIPELINES,
                    search: (previous) => ({
                      ...validatePipelinesSearch(previous),
                      tab,
                    }),
                    resetScroll: false,
                  });
                }}
                className="w-full gap-4"
              >
                <InlineStack gap="3">
                  <TabsList aria-label="Pipelines">
                    <TabsTrigger value="local">Local Pipelines</TabsTrigger>
                    <TabsTrigger value="remote">Remote Pipelines</TabsTrigger>
                  </TabsList>
                  {examples}
                </InlineStack>
                <TabsContent value="local">
                  <PipelineSection />
                </TabsContent>
                <TabsContent value="remote">{remotePipelines}</TabsContent>
              </Tabs>
            ) : (
              <>
                <InlineStack>{examples}</InlineStack>
                {localOnly ? <PipelineSection /> : remotePipelines}
              </>
            )}
          </>
        )}
      </BlockStack>
    </BlockStack>
  );
}
