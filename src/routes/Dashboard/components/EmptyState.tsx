import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export const EmptyState = ({
  icon,
  message,
  children,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  message: string;
  children?: ReactNode;
}) => (
  <BlockStack gap="3" align="center" className="py-8">
    <div className="rounded-full bg-muted p-3 text-muted-foreground">
      <Icon name={icon} size="xl" />
    </div>
    <Text as="p" size="sm" tone="subdued" className="max-w-xs text-center">
      {message}
    </Text>
    {children}
  </BlockStack>
);
