import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { cn } from "@/lib/utils";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";

import { registerDockAreaElement } from "./snapUtils";
import {
  COLLAPSED_DOCK_AREA_WIDTH,
  MAX_DOCK_AREA_WIDTH,
  MIN_DOCK_AREA_WIDTH,
} from "./types";
import { Window } from "./Window";
import {
  getDockAreaConfig,
  getDockAreaWidth,
  setDockAreaWidth,
  toggleDockAreaCollapsed,
} from "./windows.actions";

interface DockAreaProps {
  side: "left" | "right";
}

export const DockArea = observer(function DockArea({ side }: DockAreaProps) {
  const dockArea = getDockAreaConfig(side);
  const { collapsed, windowOrder } = dockArea;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isEmpty = windowOrder.length === 0;

  useEffect(() => {
    return () => {
      registerDockAreaElement(side, null);
    };
  }, [side]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || collapsed || isEmpty) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0 && Math.abs(newWidth - getDockAreaWidth(side)) > 1) {
          setDockAreaWidth(side, Math.round(newWidth));
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
    toggleDockAreaCollapsed(side);
  };

  const handleSide = side === "left" ? "right" : "left";

  if (collapsed) {
    return (
      <div
        ref={setRef}
        data-dock-area={side}
        className={cn(
          "relative shrink-0 bg-gray-100 border-gray-300",
          side === "left" ? "border-r" : "border-l",
        )}
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
      className={cn(
        "relative shrink-0 bg-gray-100/80",
        side === "left"
          ? "border-r border-gray-300"
          : "border-l border-gray-300",
      )}
      style={{ width: dockArea.width }}
    >
      <div
        data-dock-scroll
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
      >
        <BlockStack gap="0">
          {windowOrder.map((windowId) => (
            <Window key={windowId} windowId={windowId} docked />
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
