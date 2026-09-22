import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface WindowListRowProps {
  icon: IconName;
  title: string;
  description: ReactNode;
  titleSubdued?: boolean;
  disabled?: boolean;
  testId?: string;
  onOpen: () => void;
  action?: ReactNode;
}

export function WindowListRow({
  icon,
  title,
  description,
  titleSubdued,
  disabled,
  testId,
  onOpen,
  action,
}: WindowListRowProps) {
  return (
    <InlineStack
      blockAlign="start"
      wrap="nowrap"
      className="w-full hover:bg-accent"
    >
      <Button
        variant="ghost"
        disabled={disabled}
        data-testid={testId}
        title={title}
        onClick={onOpen}
        className="h-auto min-w-0 flex-1 items-start justify-start gap-3 px-2 py-2"
      >
        <InlineStack
          align="center"
          blockAlign="center"
          className="size-9 shrink-0 rounded-md bg-muted text-muted-foreground"
        >
          <Icon name={icon} size="lg" />
        </InlineStack>
        <BlockStack align="start" className="min-w-0 text-left">
          <Text
            size="sm"
            weight="medium"
            tone={titleSubdued ? "subdued" : "inherit"}
            className="max-w-full truncate"
          >
            {title}
          </Text>
          {typeof description === "string" ? (
            <Text size="xs" tone="subdued" className="max-w-full truncate">
              {description}
            </Text>
          ) : (
            description
          )}
        </BlockStack>
      </Button>
      {action}
    </InlineStack>
  );
}
