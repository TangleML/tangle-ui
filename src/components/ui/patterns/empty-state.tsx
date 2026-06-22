import { forwardRef, type ReactNode, type Ref } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";

/**
 * EmptyState — Layer 3 semantic primitive.
 *
 * Centered placeholder for empty content (no rows, no results, no data).
 * Encodes the recurring `flex items-center justify-center text-center p-*` pattern
 * (~10 hits across v2).
 */

interface EmptyStateProps {
  /** Optional decorative icon shown above the title. */
  icon?: IconName;
  /** Headline. */
  title: ReactNode;
  /** Supporting description. */
  description?: ReactNode;
  /** Optional call-to-action (button, link, etc.). */
  action?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState({ icon, title, description, action }, ref) {
    return (
      <BlockStack
        ref={ref as Ref<HTMLDivElement>}
        fill
        gap="3"
        align="center"
        inlineAlign="center"
      >
        {icon && <Icon name={icon} size="xl" tone="subdued" />}
        <Heading level={3}>{title}</Heading>
        {description && (
          <Paragraph tone="subdued" align="center">
            {description}
          </Paragraph>
        )}
        {action}
      </BlockStack>
    );
  },
);

EmptyState.displayName = "EmptyState";
