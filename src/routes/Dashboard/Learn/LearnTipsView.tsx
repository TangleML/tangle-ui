import { TipsLibrary } from "@/components/Learn/TipsLibrary";
import { PageHeader } from "@/components/shared/PageHeader";
import { BlockStack } from "@/components/ui/layout";

export function LearnTipsView() {
  return (
    <BlockStack gap="8">
      <PageHeader
        title="Tips & Tricks"
        description="Useful tips covering shortcuts, features and best practices."
        icon="Lightbulb"
        backTo="/learn"
        backLabel="Back to Learning Hub"
        backTrackingId="learning_hub.back"
      />
      <TipsLibrary />
    </BlockStack>
  );
}
