import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";

export function GraphDiffPlaceholder() {
  return (
    <BlockStack fill gap="2" className="py-16 text-center">
      <Icon name="GitCompare" size="lg" className="text-muted-foreground" />
      <Heading level={3}>Visual graph comparison is coming soon</Heading>
      <Paragraph size="sm" tone="subdued">
        A merged graph that overlays both runs and highlights where they differ
        will live here. For now, use the Structured and YAML tabs.
      </Paragraph>
    </BlockStack>
  );
}
