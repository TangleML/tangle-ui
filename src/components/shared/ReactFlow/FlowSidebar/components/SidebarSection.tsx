import { type ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface SidebarSectionProps {
  /** Section header title */
  title: string;
  /** Optional action element displayed on the right side of the header */
  headerAction?: ReactNode;
  /** Section content */
  children: ReactNode;
  /** Additional class names for the section container */
  className?: string;
}

export const SidebarSection = ({
  title,
  headerAction,
  children,
  className,
}: SidebarSectionProps) => {
  return (
    <BlockStack gap="2" className={cn("p-2", className)}>
      <InlineStack align="space-between" className="w-full">
        <Text
          as="h3"
          size="sm"
          className="font-medium text-sidebar-foreground/70"
        >
          {title}
        </Text>
        {headerAction}
      </InlineStack>

      {children}
    </BlockStack>
  );
};
