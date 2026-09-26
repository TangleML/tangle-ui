import type { ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";

interface StatItemProps {
  label: string;
  value: number | string;
}

export function StatItem({ label, value }: StatItemProps) {
  return (
    <InlineStack blockAlign="center" className="justify-between py-1" gap="2">
      <Text size="xs" tone="subdued">
        {label}
      </Text>
      <Text size="xs" weight="semibold" className="font-mono text-foreground">
        {value}
      </Text>
    </InlineStack>
  );
}

interface StatGroupProps {
  title: string;
  children: ReactNode;
}

export function StatGroup({ title, children }: StatGroupProps) {
  return (
    <BlockStack gap="1">
      <Heading level={3} size="xs" weight="semibold" tone="subdued">
        {title}
      </Heading>
      <BlockStack className="pl-2 border-l-2 border-border">
        {children}
      </BlockStack>
    </BlockStack>
  );
}
