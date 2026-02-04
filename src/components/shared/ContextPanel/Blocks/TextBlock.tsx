import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { CopyText } from "../../CopyText/CopyText";

interface TextBlockProps {
  title?: string;
  text?: string;
  copyable?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  mono?: boolean;
  wrap?: boolean;
  className?: string;
}

export const TextBlock = ({
  title,
  text,
  copyable,
  collapsible,
  defaultCollapsed = true,
  mono,
  wrap = false,
  className,
}: TextBlockProps) => {
  if (!text) {
    return null;
  }

  const textClassName = cn("text-xs text-muted-foreground", {
    "font-mono": mono,
    "wrap-break-words": wrap,
    truncate: !wrap,
  });

  const content = copyable ? (
    <CopyText className={textClassName}>{text}</CopyText>
  ) : (
    <Paragraph
      tone="subdued"
      font={mono ? "mono" : "default"}
      size="xs"
      className={wrap ? "wrap-break-words" : "truncate"}
    >
      {text}
    </Paragraph>
  );

  return (
    <BlockStack className={className}>
      <Collapsible className="w-full" defaultOpen={!defaultCollapsed}>
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
            {content}
          </CollapsibleContent>
        ) : (
          content
        )}
      </Collapsible>
    </BlockStack>
  );
};
