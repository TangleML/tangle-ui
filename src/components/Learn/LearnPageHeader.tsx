import { Link } from "@tanstack/react-router";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

interface LearnPageHeaderProps {
  title: string;
  description?: string;
  icon?: IconName;
  backTo?: string;
  backLabel?: string;
}

export function LearnPageHeader({
  title,
  description,
  icon,
  backTo,
  backLabel = "Back to Learning Hub",
}: LearnPageHeaderProps) {
  return (
    <BlockStack gap="2">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
          {...tracking("learning_hub.back", { from: title })}
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
      </InlineStack>
      {description && (
        <Paragraph size="md" tone="subdued">
          {description}
        </Paragraph>
      )}
    </BlockStack>
  );
}
