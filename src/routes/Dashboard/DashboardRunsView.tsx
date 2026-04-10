import { RunSection } from "@/components/Home/RunSection/RunSection";
import { PipelineRunFiltersBar } from "@/components/shared/PipelineRunFiltersBar/PipelineRunFiltersBar";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function DashboardRunsView() {
  return (
    <BlockStack gap="4">
      <Text as="h2" size="lg" weight="semibold">
        Runs
      </Text>
      <PipelineRunFiltersBar />
      <RunSection hideFilters />
    </BlockStack>
  );
}
