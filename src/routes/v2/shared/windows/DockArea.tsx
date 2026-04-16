import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { cn } from "@/lib/utils";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { registerDockAreaElement } from "./snapUtils";
import {
  COLLAPSED_DOCK_AREA_WIDTH,
  MAX_DOCK_AREA_WIDTH,
  MIN_DOCK_AREA_WIDTH,
} from "./types";
import { Window } from "./Window";

interface DockAreaProps {
  side: "left" | "right";
}

export const DockArea = observer(function DockArea({ side }: DockAreaProps) {
  const { windows } = useSharedStores();
  const dockArea = windows.getDockAreaConfig(side);
  const { collapsed, windowOrder } = dockArea;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const visibleWindows = windowOrder.filter((id) => {
    const win = windows.getWindowById(id);
    return win && win.state !== "hidden";
  });
  const isEmpty = visibleWindows.length === 0;

  useEffect(() => {
    windows.enableDockSide(side);
    return () => {
      windows.disableDockSide(side);
      registerDockAreaElement(side, null);
    };
  }, [side]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || collapsed || isEmpty) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (
          newWidth > 0 &&
          Math.abs(newWidth - windows.getDockAreaWidth(side)) > 1
        ) {
          windows.setDockAreaWidth(side, Math.round(newWidth));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [side, collapsed, isEmpty]);

  if (isEmpty || focusModeStore.active) return null;

  const setRef = (element: HTMLDivElement | null) => {
    containerRef.current = element;
    registerDockAreaElement(side, element);
  };

  const handleToggleCollapse = () => {
    windows.toggleDockAreaCollapsed(side);
  };

  const handleSide = side === "left" ? "right" : "left";

  if (collapsed) {
    return (
      <div
        ref={setRef}
        data-dock-area={side}
        className={cn("relative shrink-0 bg-gray-100")}
        style={{ width: COLLAPSED_DOCK_AREA_WIDTH }}
      >
        <VerticalResizeHandle
          side={handleSide}
          minWidth={COLLAPSED_DOCK_AREA_WIDTH}
          maxWidth={COLLAPSED_DOCK_AREA_WIDTH}
          onDoubleClick={handleToggleCollapse}
        />
      </div>
    );
  }

  return (
    <div
      ref={setRef}
      data-dock-area={side}
      className={cn("relative shrink-0 bg-white")}
      style={{ width: dockArea.width }}
    >
      <div
        data-dock-scroll
        className="absolute inset-0 overflow-y-auto overflow-x-hidden hide-scrollbar"
      >
        <BlockStack gap="0">
          {visibleWindows.map((windowId, index) => (
            <Window
              key={windowId}
              windowId={windowId}
              docked
              dockIndex={index}
            />
          ))}
        </BlockStack>
      </div>

      <VerticalResizeHandle
        side={handleSide}
        minWidth={MIN_DOCK_AREA_WIDTH}
        maxWidth={MAX_DOCK_AREA_WIDTH}
        onDoubleClick={handleToggleCollapse}
      />
    </div>
  );
});
