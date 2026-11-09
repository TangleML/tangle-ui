import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { ListRowIcon } from "./ListRowIcon";

type RowOpening =
  | {
      onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
      externalHref?: never;
    }
  | { externalHref: string; onOpen?: never };

type WindowListRowProps = RowOpening & {
  icon: IconName;
  title: string;
  description: ReactNode;
  titleSubdued?: boolean;
  disabled?: boolean;
  testId?: string;
  action?: ReactNode;
};

const ROW_BUTTON_CLASS =
  "h-auto min-w-0 flex-1 items-start justify-start gap-3 px-2 py-2";

export function WindowListRow({
  icon,
  title,
  description,
  titleSubdued,
  disabled,
  testId,
  onOpen,
  externalHref,
  action,
  ...rest
}: WindowListRowProps & Omit<ComponentProps<typeof Button>, "onClick">) {
  const content = (
    <>
      <ListRowIcon icon={icon} />
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
    </>
  );

  return (
    <InlineStack
      blockAlign="start"
      wrap="nowrap"
      className="w-full hover:bg-accent"
    >
      {externalHref === undefined ? (
        <Button
          variant="ghost"
          disabled={disabled}
          data-testid={testId}
          title={title}
          onClick={onOpen}
          {...rest}
          className={ROW_BUTTON_CLASS}
        >
          {content}
        </Button>
      ) : (
        <Button
          variant="ghost"
          asChild
          data-testid={testId}
          title={title}
          {...rest}
          className={ROW_BUTTON_CLASS}
        >
          <a href={externalHref} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        </Button>
      )}
      {action}
    </InlineStack>
  );
}
