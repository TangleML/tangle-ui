import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useState,
} from "react";

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

export interface ComponentHoverPopoverHandle {
  close: () => void;
}

const HOVER_DELAY_MS = 100;

export const ComponentHoverPopover = forwardRef<
  ComponentHoverPopoverHandle,
  ComponentHoverPopoverProps
>(({ component, children }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const delaySetIsOpen = debounce(
    (value: boolean) => setIsOpen(value),
    HOVER_DELAY_MS,
  );

  useImperativeHandle(ref, () => ({ close: () => setIsOpen(false) }), []);

  const handleMouseEnter = () => delaySetIsOpen(true);
  const handleMouseLeave = () => delaySetIsOpen(false);

  const handleOpenChange = (open: boolean) => {
    /**
     * Only react to close requests - opening is controlled by hover handlers only.
     * This prevents the popover from opening when a dialog is closed.
     */
    if (!open) {
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        asChild
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={16}
        className="w-80 max-h-96 overflow-auto p-0"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
});

ComponentHoverPopover.displayName = "ComponentHoverPopover";
