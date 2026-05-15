import { LearnComingSoon } from "@/components/Learn/LearnComingSoon";
import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnExamplesView() {
  return (
    <BlockStack gap="8">
      <LearnPageHeader
        title="Example Pipelines"
        description="Ready-made pipelines you can import and run to learn by example."
        icon="Sparkles"
        backTo="/learn"
      />
      <LearnComingSoon
        title="Example pipelines are on the way"
        description="A gallery of importable example pipelines, organised by topic and difficulty."
        icon="Sparkles"
      />
    </BlockStack>
  );
}
