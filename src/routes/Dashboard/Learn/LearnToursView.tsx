import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { ToursLibrary } from "@/components/Learn/ToursLibrary";
import { BlockStack } from "@/components/ui/layout";

export function LearnToursView() {
  return (
    <BlockStack gap="8">
      <LearnPageHeader
        title="Guided Tours"
        description="Interactive step-by-step walkthroughs of features across Tangle."
        icon="Compass"
        backTo="/learn"
      />
      <ToursLibrary />
    </BlockStack>
  );
}
