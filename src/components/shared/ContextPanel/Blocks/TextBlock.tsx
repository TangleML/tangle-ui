import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useCopyToClipboard } from "@/hooks/useCopyToClip";
import { cn } from "@/lib/utils";

interface TextBlockProps {
  title: string;
  text?: string;
  allowCopy?: boolean;
  collapsible?: boolean;
  className?: string;
}

export const TextBlock = ({
  title,
  text,
  allowCopy,
  collapsible,
  className,
}: TextBlockProps) => {
  const { isCopied, isTooltipOpen, handleCopy, handleTooltipOpen } =
    useCopyToClipboard(text);

  const copyButton = useMemo(
    () => (
      <Tooltip
        delayDuration={300}
        open={isTooltipOpen}
        onOpenChange={handleTooltipOpen}
      >
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
          >
            <Icon name="Clipboard" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          arrowClassName={cn(isCopied && "bg-emerald-200 fill-emerald-200")}
          className={cn(isCopied && "bg-emerald-200 text-emerald-800")}
        >
          {isCopied ? "Copied" : "Copy Digest"}
        </TooltipContent>
      </Tooltip>
    ),
    [isCopied, isTooltipOpen, handleCopy, handleTooltipOpen],
  );

  const content = useMemo(
    () => (
      <InlineStack gap="2" wrap="nowrap" blockAlign="center" className="w-full">
        <Paragraph tone="subdued" size="xs" className="truncate">
          {text}
        </Paragraph>
        {allowCopy && copyButton}
      </InlineStack>
    ),
    [text, allowCopy, copyButton],
  );

  if (!text) {
    return null;
  }

  return (
    <BlockStack className={className}>
      <Collapsible className="w-full">
        <InlineStack blockAlign="center" gap="1">
          <Heading level={3}>{title}</Heading>
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
