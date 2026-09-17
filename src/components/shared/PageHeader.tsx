import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: IconName;
  badge?: ReactNode;
  backTo?: string;
  backLabel?: string;
  backTrackingId?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  badge,
  backTo,
  backLabel = "Back",
  backTrackingId,
}: PageHeaderProps) {
  return (
    <BlockStack gap="2">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
          {...(backTrackingId ? tracking(backTrackingId, { from: title }) : {})}
        >
          <Icon name="ArrowLeft" size="sm" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <InlineStack gap="3" blockAlign="center">
        {icon && (
          <Icon
            name={icon}
            size="xl"
            className="text-primary"
            aria-hidden="true"
          />
        )}
        <Heading level={1}>{title}</Heading>
        {badge}
      </InlineStack>
      {description && (
        <Paragraph size="md" tone="subdued">
          {description}
        </Paragraph>
      )}
    </BlockStack>
  );
}
