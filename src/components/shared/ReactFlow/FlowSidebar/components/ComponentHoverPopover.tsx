import { type ReactNode, useState } from "react";

import { TaskDetails } from "@/components/shared/TaskDetails";
import { BlockStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Heading } from "@/components/ui/typography";
import type { ComponentReference } from "@/utils/componentSpec";
import { debounce } from "@/utils/debounce";

interface ComponentHoverPopoverProps {
  component: ComponentReference;
  children: ReactNode;
}

const HOVER_DELAY_MS = 100;

export const ComponentHoverPopover = ({
  component,
  children,
}: ComponentHoverPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const delaySetIsOpen = debounce((open: boolean) => {
    setIsOpen(open);
  }, HOVER_DELAY_MS);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={() => delaySetIsOpen(true)}
        onMouseLeave={() => delaySetIsOpen(false)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={64}
        className="w-80 max-h-96 overflow-auto p-0"
        onMouseEnter={() => delaySetIsOpen(true)}
        onMouseLeave={() => delaySetIsOpen(false)}
      >
        <BlockStack gap="2" className="px-3 py-2">
          <Heading level={2}>{component.name}</Heading>
        </BlockStack>
        <TaskDetails
          componentRef={component}
          readOnly
          options={{ descriptionExpanded: true }}
        />
      </PopoverContent>
    </Popover>
  );
};
