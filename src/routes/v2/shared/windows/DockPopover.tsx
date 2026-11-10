import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

import { PopoverWindow } from "./components/PopoverWindow";
import { registerDockTargetElement, setDockTargetSide } from "./snapUtils";

// Menus and dialogs a window opens are portaled outside the popover, so working
// in one is not a click away from it.
const LAYERS_OPENED_FROM_POPOVER =
  '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-radix-popper-content-wrapper]';

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
  const dragging = windows.windowDrag !== null;
  const preview = windows.windowDrag?.preview;
  const targeted = preview?.type === "dock-target" && preview.side === side;
  const open = windows.isDockPopoverOpen(side) && docked.length > 0;

  useEffect(() => {
    windows.enableDockSide(side);
    setDockTargetSide(side, true);
    return () => {
      windows.disableDockSide(side);
      setDockTargetSide(side, false);
      registerDockTargetElement(side, null);
    };
  }, [windows, side]);

  // A window dragged out of the popover needs the page behind it.
  useEffect(() => {
    if (dragging) windows.setDockPopoverOpen(side, false);
  }, [windows, side, dragging]);

  // Radix listens for outside presses as they bubble, but a pipeline canvas
  // stops them first and a frame never sends them up at all, so this listens
  // ahead of the canvas and closes when focus leaves the page for a frame.
  useEffect(() => {
    if (!open) return;
    const close = () => windows.setDockPopoverOpen(side, false);
    const closeIfOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      if (target.closest(LAYERS_OPENED_FROM_POPOVER)) return;
      close();
    };
    document.addEventListener("pointerdown", closeIfOutside, true);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      window.removeEventListener("blur", close);
    };
  }, [windows, side, open]);

  if (docked.length === 0 && !dragging) return null;

  const titles = docked
    .map((id) => windows.getWindowById(id)?.title)
    .filter(Boolean)
    .join(", ");
  const label = titles || "Drop a window here";
  const close = () => windows.setDockPopoverOpen(side, false);

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
          variant="ghost"
          size="icon"
          aria-label={label}
          title={shortcutHint ? `${label} (${shortcutHint})` : label}
          data-drop-target={
            dragging ? (targeted ? "active" : "ready") : undefined
          }
          className={cn(
            "size-7 text-muted-foreground hover:text-foreground",
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
