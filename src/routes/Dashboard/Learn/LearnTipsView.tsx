import { LearnComingSoon } from "@/components/Learn/LearnComingSoon";
import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnTipsView() {
  return (
    <BlockStack gap="8">
      <LearnPageHeader
        title="Tips & Tricks"
        description="Bite-sized tips covering shortcuts, hidden features and best practices."
        icon="Lightbulb"
        backTo="/learn"
      />
      <LearnComingSoon
        title="Tips library is on the way"
        description="A browsable library of in-app tips — searchable, filterable and shareable by link."
        icon="Lightbulb"
      />
    </BlockStack>
  );
}
