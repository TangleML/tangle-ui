import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import { tips } from "./tips";

function getDayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);

  const now = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  return Math.floor((now - start) / 86_400_000);
}

interface TipOfTheDayProps {
  variant?: "card" | "compact";
}

export function TipOfTheDay({ variant = "card" }: TipOfTheDayProps = {}) {
  const index = getDayOfYear(new Date()) % tips.length;
  const tip = tips[index];
  const isCompact = variant === "compact";
  const textSize = isCompact ? "xs" : "sm";

  const badge = (
    <Badge size="sm" variant="secondary">
      {tip.category}
    </Badge>
  );

  return (
    <div
      className={
        isCompact
          ? "h-full p-2"
          : "h-full rounded-xl border border-border bg-card p-5"
      }
    >
      <BlockStack gap={isCompact ? "2" : "3"} className="h-full">
        {!isCompact && (
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
            {badge}
          </InlineStack>
        )}

        <BlockStack gap="1" className="flex-1">
          <InlineStack gap="2" blockAlign="center" align="space-between">
            <Text as="p" size={textSize} weight="semibold">
              {tip.title}
            </Text>
            {isCompact && badge}
          </InlineStack>
          <Text as="p" size={textSize} tone="subdued">
            {tip.body}
          </Text>
        </BlockStack>

        <InlineStack gap="2" blockAlign="center">
          <Button
            asChild
            size="sm"
            variant="link"
            className={isCompact ? "px-0 text-xs" : "px-0"}
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
