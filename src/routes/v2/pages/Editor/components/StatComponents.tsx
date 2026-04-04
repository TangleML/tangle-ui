import type { ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface StatItemProps {
  label: string;
  value: number | string;
}

export function StatItem({ label, value }: StatItemProps) {
  return (
    <InlineStack blockAlign="center" className="justify-between py-1" gap="2">
      <Text size="xs" className="text-gray-500">
        {label}
      </Text>
      <Text size="xs" weight="semibold" className="font-mono text-gray-700">
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
      <Text
        size="xs"
        weight="semibold"
        className="uppercase tracking-wider text-blue-600"
      >
        {title}
      </Text>
      <BlockStack className="pl-2 border-l-2 border-gray-200">
        {children}
      </BlockStack>
    </BlockStack>
  );
}
