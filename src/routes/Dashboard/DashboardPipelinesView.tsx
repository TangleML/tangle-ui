import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function DashboardPipelinesView() {
  return (
    <BlockStack gap="4">
      <Text as="h2" size="lg" weight="semibold">
        Pipelines
      </Text>
      <PipelineSection />
    </BlockStack>
  );
}
