import { Link } from "@tanstack/react-router";

import { InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

interface SectionHeaderProps {
  title: string;
  viewAllTo: string;
  viewAllLabel?: string;
}

export const SectionHeader = ({
  title,
  viewAllTo,
  viewAllLabel = "View all",
}: SectionHeaderProps) => (
  <InlineStack gap="3" blockAlign="center" className="min-w-0">
    <Heading level={2}>{title}</Heading>
    <Link
      to={viewAllTo}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      {viewAllLabel} →
    </Link>
  </InlineStack>
);
