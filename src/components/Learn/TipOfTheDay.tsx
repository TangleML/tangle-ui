import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

const STUB_TIP = {
  id: "subgraph-navigation",
  category: "Editor",
  title: "Use subgraphs to keep complex pipelines readable",
  body: "Double-click any task to dive into its subgraph. Use the breadcrumbs at the top of the editor to navigate back up — perfect for organising large pipelines without clutter.",
};

export function TipOfTheDay() {
  return (
    <div className="h-full rounded-xl border border-border bg-card p-5">
      <BlockStack gap="3" className="h-full">
        <InlineStack gap="2" blockAlign="center" align="space-between">
          <InlineStack gap="2" blockAlign="center">
            <Icon
              name="Lightbulb"
              size="md"
              className="text-amber-500"
              aria-hidden="true"
            />
            <Heading level={3}>Tip of the day</Heading>
          </InlineStack>
          <Badge size="sm" variant="secondary">
            {STUB_TIP.category}
          </Badge>
        </InlineStack>

        <BlockStack gap="1" className="flex-1">
          <Paragraph size="sm" weight="semibold">
            {STUB_TIP.title}
          </Paragraph>
          <Paragraph size="sm" tone="subdued">
            {STUB_TIP.body}
          </Paragraph>
        </BlockStack>

        <InlineStack gap="2" align="space-between" blockAlign="center">
          <Button
            asChild
            size="sm"
            variant="link"
            className="px-0"
            {...tracking("learning_hub.tip.browse_all")}
          >
            <Link to="/learn/tips">
              Browse all tips
              <Icon name="ArrowRight" size="sm" aria-hidden="true" />
            </Link>
          </Button>
        </InlineStack>
      </BlockStack>
    </div>
  );
}
