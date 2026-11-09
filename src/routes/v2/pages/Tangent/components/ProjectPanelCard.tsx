import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

import { ProjectCardContent } from "./ProjectCardContent";
import { ProjectCardDismissContext } from "./projectCardContext";

// Menus and dialogs the card opens are portaled outside it, so working in one
// is not a click away from the card.
const LAYERS_OPENED_FROM_CARD =
  '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-radix-popper-content-wrapper]';

/**
 * The project's reports, pipelines and documents in a card over the canvas,
 * rather than a dock beside it: a pipeline editor or run open there brings a
 * rail of its own, and two rails side by side read as one cluttered toolbar.
 */
export function ProjectPanelCard() {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  // Radix listens for outside presses as they bubble, but a pipeline canvas
  // stops them first and an artifact's iframe never sends them up at all, so
  // the card also listens ahead of the canvas and closes when focus leaves the
  // page for a frame.
  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (cardRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      if (target.closest(LAYERS_OPENED_FROM_CARD)) return;
      setOpen(false);
    };
    const closeOnLeave = () => setOpen(false);
    document.addEventListener("pointerdown", closeIfOutside, true);
    window.addEventListener("blur", closeOnLeave);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      window.removeEventListener("blur", closeOnLeave);
    };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label="Project contents"
          title="Reports, pipelines and documents"
          className={cn(
            "size-7 text-muted-foreground hover:text-foreground",
            open && "bg-accent text-foreground",
          )}
          {...tracking("projects.project_card.toggle")}
        >
          <Icon name="LayoutList" size="sm" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={cardRef}
        align="end"
        sideOffset={8}
        className="w-[min(92vw,360px)] overflow-hidden rounded-xl p-0"
      >
        <ProjectCardDismissContext value={close}>
          <div className="reveal-scrollbar max-h-[min(80vh,720px)] overflow-y-auto">
            <ProjectCardContent />
          </div>
        </ProjectCardDismissContext>
      </PopoverContent>
    </Popover>
  );
}
