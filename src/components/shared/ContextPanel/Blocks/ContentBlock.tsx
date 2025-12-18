import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

type ContentBlockProps =
  | {
      title?: string;
      children?: ReactNode;
      collapsible?: false;
      defaultOpen?: never;
      className?: string;
    }
  | {
      title?: string;
      children?: ReactNode;
      collapsible: true;
      defaultOpen?: boolean;
      className?: string;
    };

export const ContentBlock = ({
  title,
  children,
  collapsible,
  defaultOpen = false,
  className,
}: ContentBlockProps) => {
  if (!children) {
    return null;
  }

  return (
    <BlockStack className={className}>
      <Collapsible className="w-full" defaultOpen={defaultOpen}>
        <InlineStack blockAlign="center" gap="1">
          {title && <Heading level={3}>{title}</Heading>}
          {collapsible && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <Icon name="ChevronsUpDown" />
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          )}
        </InlineStack>

        {collapsible ? (
          <CollapsibleContent className="w-full mt-1">
            {children}
          </CollapsibleContent>
        ) : (
          children
        )}
      </Collapsible>
    </BlockStack>
  );
};
