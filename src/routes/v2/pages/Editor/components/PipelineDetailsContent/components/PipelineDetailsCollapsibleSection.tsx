import type { ReactNode } from "react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

interface PipelineDetailsCollapsibleSectionProps {
  title: string;
  icon: IconName;
  openDefault: boolean;
  children: ReactNode;
}

export function PipelineDetailsCollapsibleSection({
  title,
  icon,
  openDefault,
  children,
}: PipelineDetailsCollapsibleSectionProps) {
  const [open, setOpen] = useState(openDefault);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
        <InlineStack gap="2" blockAlign="center">
          <Icon name={icon} size="xs" />
          <Heading level={2}>{title}</Heading>
        </InlineStack>
        <Icon
          name={open ? "ChevronDown" : "ChevronRight"}
          size="xs"
          className="text-muted-foreground"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
