import { LearnComingSoon } from "@/components/Learn/LearnComingSoon";
import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnToursView() {
  return (
    <BlockStack gap="8">
      <LearnPageHeader
        title="Guided Tours"
        description="Interactive step-by-step walkthroughs of features across the app."
        icon="Compass"
        backTo="/learn"
      />
      <LearnComingSoon
        title="Tours are on the way"
        description="Launch interactive tours that highlight UI elements and walk you through real workflows."
        icon="Compass"
      />
    </BlockStack>
  );
}
