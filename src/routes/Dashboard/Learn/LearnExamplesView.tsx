import { ExamplePipelines } from "@/components/Learn/ExamplePipelines";
import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnExamplesView() {
  return (
    <BlockStack gap="8">
      <LearnPageHeader
        title="Example Pipelines"
        description="Ready-made pipelines you can import and run to learn by example. Click any card to begin exploring."
        icon="Presentation"
        backTo="/learn"
      />
      <ExamplePipelines />
    </BlockStack>
  );
}
