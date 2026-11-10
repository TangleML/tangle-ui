import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDismissOnOutsidePress } from "@/hooks/useDismissOnOutsidePress";
import { cn } from "@/lib/utils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

import { PopoverWindow } from "./components/PopoverWindow";
import { registerDockTargetElement } from "./snapUtils";

interface DockPopoverProps {
  side: "left" | "right";
  icon: IconName;
  trackingId: string;
  shortcutHint?: string;
}

/**
 * A dock side shown as one button and a popover instead of a column. Its
 * windows stack in the popover, each folding to its header and dragged out by
 * it, and a window dropped on the button joins the bottom of the stack. The
 * button hides while nothing is docked here and comes back during a drag, so
 * there's always somewhere to drop.
 */
export const DockPopover = observer(function DockPopover({
  side,
  icon,
  trackingId,
  shortcutHint,
}: DockPopoverProps) {
  const { windows } = useSharedStores();
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const docked = windows
    .getDockedWindowOrder(side)
    .filter((id) => windows.getWindowById(id)?.state !== "hidden");
  const dragging = windows.isDraggingWindow;
  const targeted = windows.dropTargetSide === side;
  const open = windows.isDockPopoverOpen(side) && docked.length > 0;
  const close = () => windows.setDockPopoverOpen(side, false);

  useEffect(() => {
    windows.enablePopoverDock(side);
    return () => {
      windows.disablePopoverDock(side);
      registerDockTargetElement(side, null);
    };
  }, [windows, side]);

  useDismissOnOutsidePress({
    open,
    refs: [triggerRef, contentRef],
    onDismiss: close,
  });

  if (docked.length === 0 && !dragging) return null;

  const titles = docked
    .map((id) => windows.getWindowById(id)?.title)
    .filter(Boolean)
    .join(", ");
  const label = titles || "Drop a window here";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => windows.setDockPopoverOpen(side, next)}
    >
      <PopoverTrigger asChild>
        <Button
          ref={(element) => {
            triggerRef.current = element;
            registerDockTargetElement(side, element);
          }}
          variant="subtle"
          size="icon-sm"
          aria-label={label}
          title={shortcutHint ? `${label} (${shortcutHint})` : label}
          data-drop-target={
            dragging ? (targeted ? "active" : "ready") : undefined
          }
          className={cn(
            open && "bg-accent text-foreground",
            dragging && "ring-1 ring-primary/40",
            targeted && "bg-primary/15 text-foreground ring-2 ring-primary",
          )}
          {...tracking(trackingId)}
        >
          <Icon name={icon} size="sm" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        tabIndex={-1}
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(event) => {
          // A window may already have put focus where it wants it, such as a
          // search box; otherwise focus the popover itself, not a header.
          event.preventDefault();
          if (!contentRef.current?.contains(document.activeElement)) {
            contentRef.current?.focus();
          }
        }}
        className="w-[min(92vw,360px)] overflow-hidden rounded-xl p-0 outline-none"
      >
        <div className="reveal-scrollbar max-h-[min(80vh,720px)] overflow-y-auto">
          {docked.map((id) => (
            <PopoverWindow key={id} windowId={id} onDismiss={close} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});
