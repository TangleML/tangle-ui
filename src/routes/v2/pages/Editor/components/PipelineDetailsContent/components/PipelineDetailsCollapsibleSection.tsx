import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon, type IconName } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface PipelineDetailsCollapsibleSectionProps {
  title: string;
  icon: IconName;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function PipelineDetailsCollapsibleSection({
  title,
  icon,
  open,
  onOpenChange,
  children,
}: PipelineDetailsCollapsibleSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <InlineStack gap="2" blockAlign="center">
          <Icon name={icon} size="xs" />
          <Text size="sm" weight="semibold">
            {title}
          </Text>
        </InlineStack>
        <Icon
          name={open ? "ChevronDown" : "ChevronRight"}
          size="xs"
          className="shrink-0 text-muted-foreground"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
