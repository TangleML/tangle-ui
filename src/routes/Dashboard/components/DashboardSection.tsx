import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

const SectionHeader = ({
  title,
  count,
  actionLabel,
  onAction,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <CardHeader>
    <InlineStack
      gap="2"
      align="space-between"
      blockAlign="center"
      wrap="nowrap"
    >
      <InlineStack gap="2" blockAlign="baseline">
        <CardTitle className="text-base">{title}</CardTitle>
        {count !== undefined && (
          <Text as="span" size="xs" tone="subdued">
            ({count})
          </Text>
        )}
      </InlineStack>
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          className="text-xs text-muted-foreground"
        >
          {actionLabel}
          <Icon name="ArrowRight" size="xs" />
        </Button>
      )}
    </InlineStack>
  </CardHeader>
);

export const DashboardSection = ({
  title,
  count,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) => (
  <Card className="gap-0 overflow-hidden border-0 bg-transparent shadow-none">
    <SectionHeader
      title={title}
      count={count}
      actionLabel={actionLabel}
      onAction={onAction}
    />
    <CardContent className="overflow-hidden p-0">
      <BlockStack gap="3" className="min-w-0 px-3 pb-3 pt-2">
        {children}
      </BlockStack>
    </CardContent>
  </Card>
);
