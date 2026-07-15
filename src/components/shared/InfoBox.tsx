import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface InfoBoxProps {
  title: string;
  width?: "full" | "fit" | "auto";
  className?: string;
  children: ReactNode;
  variant?: "info" | "error" | "warning" | "success" | "ghost";
  onDismiss?: () => void;
}

const variantStyles: Record<
  NonNullable<InfoBoxProps["variant"]>,
  { container: string; title: string }
> = {
  info: {
    container: "border-blue-200 bg-blue-50 dark:border-info/30 dark:bg-info/10",
    title: "text-blue-800 dark:text-info",
  },
  error: {
    container:
      "border-red-200 bg-red-50 dark:border-destructive/30 dark:bg-destructive/10",
    title: "text-red-800 dark:text-destructive",
  },
  warning: {
    container:
      "border-yellow-200 bg-yellow-50 dark:border-warning/30 dark:bg-warning/10",
    title: "text-yellow-800 dark:text-warning",
  },
  success: {
    container:
      "border-green-200 bg-green-50 dark:border-success/30 dark:bg-success/10",
    title: "text-green-800 dark:text-success",
  },
  ghost: {
    container: "border-gray-200 bg-none dark:border-border",
    title: "text-gray-800 dark:text-foreground",
  },
};

const widthStyles: Record<NonNullable<InfoBoxProps["width"]>, string> = {
  full: "w-full",
  auto: "w-auto",
  fit: "w-fit",
};

export const InfoBox = ({
  title,
  width = "auto",
  className,
  children,
  variant = "info",
  onDismiss,
}: InfoBoxProps) => {
  const styles = variantStyles[variant];
  const widthClass = widthStyles[width];

  return (
    <div
      data-testid={`info-box-${variant}`}
      className={cn("border rounded-md p-2", styles.container, widthClass)}
    >
      <InlineStack align="space-between" blockAlign="start">
        <Text
          as="span"
          size="sm"
          weight="semibold"
          className={cn("mb-1", styles.title)}
          data-testid="info-box-title"
        >
          {title}
        </Text>
        {onDismiss && (
          <Button
            onClick={onDismiss}
            variant="ghost"
            size="min"
            aria-label="Dismiss"
          >
            <Icon name="X" size="sm" />
          </Button>
        )}
      </InlineStack>
      <div className={cn("text-sm", className)}>{children}</div>
    </div>
  );
};
