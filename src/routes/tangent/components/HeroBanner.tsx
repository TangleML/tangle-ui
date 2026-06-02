import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { StatBoxes } from "@/routes/tangent/components/StatBoxes";

export function HeroBanner() {
  return (
    <BlockStack
      gap="4"
      className="rounded-xl border border-border bg-muted/30 p-6"
    >
      <BlockStack gap="2">
        <Heading level={1}>
          Scenarios in. Optimized models out. Tangent ships.
        </Heading>
        <Paragraph size="sm" tone="subdued" className="max-w-3xl">
          Drop a pipeline. Build a scenario in minutes. Tangent runs the
          experiments autonomously — Bayesian search, failure recovery,
          best-config promotion. No babysitting required.
        </Paragraph>
      </BlockStack>
      <StatBoxes />
    </BlockStack>
  );
}
