import { isValidElement, type ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

interface ActionBlockProps {
  title?: string;
  actions: ReactNode[];
  className?: string;
}

export const ActionBlock = ({
  title,
  actions,
  className,
}: ActionBlockProps) => {
  return (
    <BlockStack className={className}>
      {title && <Heading level={3}>{title}</Heading>}
      <InlineStack gap="2">
        {actions.map((action, index) => {
          const key = isValidElement(action) && action.key ? action.key : index;
          return <span key={key}>{action}</span>;
        })}
      </InlineStack>
    </BlockStack>
  );
};
