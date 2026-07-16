import { observer } from "mobx-react-lite";
import { type CSSProperties, useEffect, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { WindowContextProvider } from "./ContentWindowStateContext";
import { MAX_DOCK_AREA_WIDTH } from "./types";

interface CollapsedDockWindowMiniProps {
  windowId: string;
  dockSide: "left" | "right";
}

export const CollapsedDockWindowMini = observer(
  function CollapsedDockWindowMini({
    windowId,
    dockSide,
  }: CollapsedDockWindowMiniProps) {
    const { windows } = useSharedStores();
    const [open, setOpen] = useState(false);
    const model = windows.getWindowById(windowId);
    const mini = windows.getWindowMiniContent(windowId);
    const content = windows.getWindowContent(windowId);

    // Radix handles outside-clicks by listening for a bubbling `pointerdown`
    // on `document`. The React Flow canvas (d3-zoom) stops propagation of
    // `pointerdown`, so that listener never fires and the popover stays open
    // when clicking the canvas. We can't use a modal popover to work around
    // this: modal disables outside pointer events, which breaks drag-and-drop
    // of components onto the canvas. Instead we close explicitly on the one
    // case Radix misses - a capture-phase pointerdown that lands on the canvas.
    useEffect(() => {
      if (!open) return;
      const handlePointerDownCapture = (event: PointerEvent) => {
        const target = event.target;
        if (target instanceof Element && target.closest(".react-flow")) {
          setOpen(false);
        }
      };
      document.addEventListener("pointerdown", handlePointerDownCapture, true);
      return () => {
        document.removeEventListener(
          "pointerdown",
          handlePointerDownCapture,
          true,
        );
      };
    }, [open]);

    if (!model || model.state === "hidden" || !mini || !content) {
      return null;
    }

    const popoverSide = dockSide === "left" ? "right" : "left";
    const panelWidth = Math.min(model.size.width, MAX_DOCK_AREA_WIDTH);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        {/*
          Radix asChild merges ref and listeners onto one DOM node. Mini content
          is often a MobX observer() component that does not forwardRef to a host
          element, so we wrap it in a div that receives the trigger props.
        */}
        <PopoverTrigger asChild>
          <div className="relative z-20 flex w-full shrink-0 justify-center outline-none">
            {mini}
          </div>
        </PopoverTrigger>
        <PopoverContent
          side={popoverSide}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "p-0 overflow-hidden flex flex-col border shadow-lg z-50",
            "max-h-[min(70vh,720px)] w-[min(92vw,var(--dock-mini-popover-w))]",
          )}
          style={
            {
              "--dock-mini-popover-w": `${panelWidth}px`,
            } as CSSProperties
          }
        >
          <div className="shrink-0 border-b bg-card px-2 py-1.5">
            <Text size="xs" weight="semibold" className="truncate">
              {model.title}
            </Text>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-card">
            <WindowContextProvider value={{ model, content }}>
              {content}
            </WindowContextProvider>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
