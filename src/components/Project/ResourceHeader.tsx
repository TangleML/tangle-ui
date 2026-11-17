import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ResourceHeaderProps {
  icon: IconName;
  title: string;
  status?: string;
  children: ReactNode;
}

export function ResourceHeader({
  icon,
  title,
  status,
  children,
}: ResourceHeaderProps) {
  return (
    <InlineStack
      gap="2"
      wrap="nowrap"
      className="w-full shrink-0 border-b border-border px-3 py-1.5"
    >
      <Icon name={icon} size="xs" className="shrink-0 text-muted-foreground" />
      <Text size="sm" weight="medium" className="truncate">
        {title}
      </Text>
      {status && (
        <Text size="xs" tone="subdued" className="shrink-0">
          {status}
        </Text>
      )}
      <InlineStack gap="1" wrap="nowrap" className="ml-auto shrink-0">
        {children}
      </InlineStack>
    </InlineStack>
  );
}
