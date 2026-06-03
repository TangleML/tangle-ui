import { LearnPageHeader } from "@/components/Learn/LearnPageHeader";
import { TipsLibrary } from "@/components/Learn/TipsLibrary";
import { BlockStack } from "@/components/ui/layout";

export function LearnTipsView() {
  return (
    <BlockStack gap="8">
      <LearnPageHeader
        title="Tips & Tricks"
        description="Useful tips covering shortcuts, features and best practices."
        icon="Lightbulb"
        backTo="/learn"
      />
      <TipsLibrary />
    </BlockStack>
  );
}
