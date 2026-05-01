import { observer } from "mobx-react-lite";
import type { CSSProperties } from "react";

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
    const model = windows.getWindowById(windowId);
    const mini = windows.getWindowMiniContent(windowId);
    const content = windows.getWindowContent(windowId);

    if (!model || model.state === "hidden" || !mini || !content) {
      return null;
    }

    const popoverSide = dockSide === "left" ? "right" : "left";
    const panelWidth = Math.min(model.size.width, MAX_DOCK_AREA_WIDTH);

    return (
      <Popover>
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
          <div className="shrink-0 border-b bg-white px-2 py-1.5">
            <Text size="xs" weight="semibold" className="truncate">
              {model.title}
            </Text>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <WindowContextProvider value={{ model, content }}>
              {content}
            </WindowContextProvider>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
