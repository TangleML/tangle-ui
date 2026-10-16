import { useNavigate, useSearch } from "@tanstack/react-router";

import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";

import { FavoritesPreview } from "./FavoritesPreview";
import { validatePipelinesSearch } from "./pipelinesSearch";
import { RemotePipelinesTable } from "./RemotePipelinesTable";

export function DashboardPipelinesView() {
  const navigate = useNavigate();
  const search = validatePipelinesSearch(useSearch({ strict: false }));
  const tab = search.tab ?? (search.page ? "remote" : "local");
  const page = search.page ?? 1;

  function changePage(page: number, replace = false) {
    return navigate({
      to: APP_ROUTES.DASHBOARD_PIPELINES,
      search: (previous) => ({ ...previous, tab: "remote", page }),
      resetScroll: false,
      replace,
    });
  }

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
        <Tabs
          value={tab}
          onValueChange={(tab) => {
            if (tab !== "local" && tab !== "remote") return;
            void navigate({
              to: APP_ROUTES.DASHBOARD_PIPELINES,
              search: (previous) => ({ ...previous, tab }),
              resetScroll: false,
            });
          }}
          className="w-full gap-4"
        >
          <TabsList aria-label="Pipelines">
            <TabsTrigger value="local">Local Pipelines</TabsTrigger>
            <TabsTrigger value="remote">Remote Pipelines</TabsTrigger>
          </TabsList>
          <TabsContent value="local">
            <PipelineSection />
          </TabsContent>
          <TabsContent value="remote">
            <RemotePipelinesTable page={page} onPageChange={changePage} />
          </TabsContent>
        </Tabs>
      </BlockStack>
    </BlockStack>
  );
}
