import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { useContextPanel } from "@/providers/ContextPanelProvider";

import { ContextPanel } from "./ContextPanel";

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 400;

export function CollapsibleContextPanel() {
  const { open, setOpen } = useContextPanel();

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="h-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-[95px] z-0 transition-all duration-300 bg-white rounded-r-none shadow-md -translate-x-9"
          aria-label={open ? "Collapse context panel" : "Expand context panel"}
        >
          <Icon name={open ? "PanelRightClose" : "PanelRightOpen"} />
        </Button>
      </CollapsibleTrigger>
      <div
        className="relative h-full flex"
        style={{ width: open ? `${DEFAULT_WIDTH}px` : "0px" }}
      >
        {open && (
          <VerticalResizeHandle
            side="left"
            minWidth={MIN_WIDTH}
            maxWidth={MAX_WIDTH}
          />
        )}

        <CollapsibleContent className="flex-1 h-full overflow-hidden">
          <ContextPanel />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
