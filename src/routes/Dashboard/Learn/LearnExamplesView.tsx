import { ExamplePipelines } from "@/components/Learn/ExamplePipelines";
import { PageHeader } from "@/components/shared/PageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnExamplesView() {
  return (
    <BlockStack gap="8">
      <PageHeader
        title="Example Pipelines"
        description="Ready-made pipelines you can import and run to learn by example. Click any card to begin exploring."
        icon="Presentation"
        backTo="/learn"
        backLabel="Back to Learning Hub"
        backTrackingId="learning_hub.back"
      />
      <ExamplePipelines />
    </BlockStack>
  );
}
