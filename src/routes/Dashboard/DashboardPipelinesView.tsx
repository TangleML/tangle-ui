import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

export function DashboardPipelinesView() {
  return (
    <BlockStack gap="4">
      <Heading level={2}>Pipelines</Heading>
      <PipelineSection />
    </BlockStack>
  );
}
