import { ToursLibrary } from "@/components/Learn/ToursLibrary";
import { PageHeader } from "@/components/shared/PageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnToursView() {
  return (
    <BlockStack gap="8">
      <PageHeader
        title="Guided Tours"
        description="Interactive step-by-step walkthroughs of features across Tangle."
        icon="Compass"
        backTo="/learn"
        backLabel="Back to Learning Hub"
        backTrackingId="learning_hub.back"
      />
      <ToursLibrary />
    </BlockStack>
  );
}
