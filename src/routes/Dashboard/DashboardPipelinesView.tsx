import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";

import { FavoritesPreview } from "./FavoritesPreview";
import {
  type RemotePipelineSearchFilters,
  validatePipelinesSearch,
} from "./pipelinesSearch";
import { RemotePipelinesTable } from "./RemotePipelinesTable";

export function DashboardPipelinesView() {
  const navigate = useNavigate();
  const search = validatePipelinesSearch(useSearch({ strict: false }));
  const { ready } = useBackend();

  function changeFilters(filters: RemotePipelineSearchFilters) {
    void navigate({
      to: APP_ROUTES.DASHBOARD_PIPELINES,
      search: (previous) => ({
        ...validatePipelinesSearch(previous),
        ...filters,
      }),
      resetScroll: false,
      replace: true,
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
        {!ready ? (
          <LoadingScreen message="Loading pipelines…" />
        ) : (
          <>
            <InlineStack>
              <Button variant="secondary" asChild>
                <Link to={APP_ROUTES.LEARN_EXAMPLES}>
                  <Icon name="Sparkles" />
                  Example Pipelines
                </Link>
              </Button>
            </InlineStack>
            <RemotePipelinesTable
              filters={search}
              onFiltersChange={changeFilters}
            />
          </>
        )}
      </BlockStack>
    </BlockStack>
  );
}
