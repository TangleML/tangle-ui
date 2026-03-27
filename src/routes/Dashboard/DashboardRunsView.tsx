import { RunSection } from "@/components/Home/RunSection/RunSection";
import { PipelineRunFiltersBar } from "@/components/shared/PipelineRunFiltersBar/PipelineRunFiltersBar";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

export function DashboardRunsView() {
  return (
    <BlockStack gap="4">
      <Heading level={2}>Runs</Heading>
      <PipelineRunFiltersBar />
      <RunSection hideFilters />
    </BlockStack>
  );
}
