import { cva, type VariantProps } from "class-variance-authority";
import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

import { Icon, type IconName } from "./icon";
import { InlineStack } from "./layout";
import { Text } from "./typography";

// A tone tints the icon and never the words. Several tone tokens are light
// enough that text set in one of them falls under the contrast floor on a light
// background, so the message itself is always muted foreground, which is legible
// on either ground.
const messageToneVariants = cva("", {
  variants: {
    tone: {
      subdued: "text-muted-foreground",
      info: "text-info",
      warning: "text-warning",
      critical: "text-destructive",
      success: "text-success",
    },
  },
  defaultVariants: {
    tone: "subdued",
  },
});

interface FieldMessageProps extends VariantProps<typeof messageToneVariants> {
  /** Leading icon. Omitted for a plain help line. */
  icon?: IconName;
  /** Hold the message to one line and ellipsize it. Suits a value, not a sentence. */
  truncate?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** A line of help, or a warning, beneath a form control. */
export function FieldMessage({
  icon,
  tone,
  truncate = false,
  className,
  children,
}: PropsWithChildren<FieldMessageProps>) {
  return (
    <InlineStack
      gap="1"
      blockAlign="start"
      wrap="nowrap"
      className={cn("min-w-0", className)}
    >
      {icon && (
        <Icon
          name={icon}
          size="xs"
          className={cn("mt-0.5 shrink-0", messageToneVariants({ tone }))}
        />
      )}
      <Text
        as="span"
        size="xs"
        tone="subdued"
        className={cn(truncate && "truncate")}
      >
        {children}
      </Text>
    </InlineStack>
  );
}
