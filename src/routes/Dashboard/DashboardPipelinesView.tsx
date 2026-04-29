import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

import { FavoritesPreview } from "./FavoritesPreview";

export function DashboardPipelinesView() {
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
        <PipelineSection />
      </BlockStack>
    </BlockStack>
  );
}
