import { Link } from "@tanstack/react-router";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";

interface LearnComingSoonProps {
  title: string;
  description: string;
  icon: IconName;
}

export function LearnComingSoon({
  title,
  description,
  icon,
}: LearnComingSoonProps) {
  return (
    <BlockStack
      gap="4"
      align="center"
      className="border border-dashed border-border rounded-xl py-16 px-6 text-center"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted">
        <Icon name={icon} size="xl" aria-hidden="true" />
      </div>
      <BlockStack gap="2" align="center">
        <Heading level={2}>{title}</Heading>
        <Paragraph size="md" tone="subdued" className="max-w-md">
          {description}
        </Paragraph>
      </BlockStack>
      <BlockStack align="center">
        <Link to="/learn" className="text-sm text-primary hover:underline">
          ← Back to Learning Hub
        </Link>
      </BlockStack>
    </BlockStack>
  );
}
