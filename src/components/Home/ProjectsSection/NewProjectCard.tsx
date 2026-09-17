import { type ComponentProps } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export function NewProjectCard({
  className,
  ...rest
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-56 w-full cursor-pointer rounded-lg border border-dashed border-border bg-transparent p-4 text-muted-foreground transition-colors",
        "hover:border-solid hover:bg-muted/50 hover:text-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        className,
      )}
      {...rest}
    >
      <BlockStack gap="2" align="center" className="h-full justify-center">
        <Icon name="Plus" size="xl" />
        <Text size="sm" weight="medium">
          New project
        </Text>
      </BlockStack>
    </button>
  );
}
