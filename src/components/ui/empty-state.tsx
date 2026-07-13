import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const emptyStateVariants = cva(
  "flex w-full flex-col items-center text-center",
  {
    variants: {
      placement: {
        center: "h-full justify-center",
        start: "justify-start",
      },
      size: {
        sm: "gap-2 p-4",
        md: "gap-3 p-6",
      },
    },
    defaultVariants: {
      placement: "center",
      size: "md",
    },
  },
);

const toneClass = {
  neutral: "text-muted-foreground",
  success: "text-green-500",
  critical: "text-destructive",
} as const;

interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  icon?: IconName;
  media?: ReactNode;
  spotlight?: boolean;
  tone?: keyof typeof toneClass;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Centered (or top-anchored) placeholder for "nothing here yet" states:
 * a hero icon/media, a title, a subtitle, and optional action content.
 */
export function EmptyState({
  icon,
  media,
  spotlight = false,
  tone = "neutral",
  title,
  description,
  children,
  placement,
  size,
  className,
  ...rest
}: EmptyStateProps) {
  const iconSize = size === "sm" ? "md" : "lg";
  const hero =
    media ??
    (icon &&
      (spotlight ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-accent",
            size === "sm" ? "size-9" : "size-11",
          )}
        >
          <Icon name={icon} size={iconSize} className={toneClass[tone]} />
        </div>
      ) : (
        <Icon name={icon} size={iconSize} className={toneClass[tone]} />
      )));

  return (
    <div
      className={cn(emptyStateVariants({ placement, size }), className)}
      {...rest}
    >
      {hero}
      {(title || description) && (
        <BlockStack gap="1" align="center">
          {title && <Text weight="semibold">{title}</Text>}
          {description && (
            <Text size="sm" tone="subdued" className="text-balance">
              {description}
            </Text>
          )}
        </BlockStack>
      )}
      {children && <div className="w-full">{children}</div>}
    </div>
  );
}
