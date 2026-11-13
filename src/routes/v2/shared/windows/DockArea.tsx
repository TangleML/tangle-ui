import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { cn } from "@/lib/utils";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { CollapsedDockWindowMini } from "./CollapsedDockWindowMini";
import { registerDockAreaElement } from "./snapUtils";
import {
  COLLAPSED_DOCK_AREA_WIDTH,
  DOCK_AREA_COLLAPSE_SNAP_THRESHOLD,
  DOCK_AREA_EXPAND_SNAP_THRESHOLD,
  MAX_DOCK_AREA_WIDTH,
  MIN_DOCK_AREA_WIDTH,
} from "./types";
import { Window } from "./Window";

interface DockAreaProps {
  side: "left" | "right";
  // Headers read as section labels rather than bars, for a sidebar.
  quietHeaders?: boolean;
}

// Context panel ("Properties") is selection-driven and stays visible in
// focus mode so users can still inspect a selected task or multi-selection
// without leaving focus mode.
const FOCUS_MODE_ALLOWED_WINDOW_IDS = new Set(["context-panel"]);

export const DockArea = observer(function DockArea({
  side,
  quietHeaders,
}: DockAreaProps) {
  const { windows } = useSharedStores();
  const dockArea = windows.getDockAreaConfig(side);
  const { collapsed } = dockArea;
  const windowOrder = windows.getDockedWindowOrder(side);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [snapPreview, setSnapPreview] = useState<"collapse" | "expand" | null>(
    null,
  );

  const visibleWindows = windowOrder.filter((id) => {
    const win = windows.getWindowById(id);
    if (!win || win.state === "hidden") return false;
    if (focusModeStore.active && !FOCUS_MODE_ALLOWED_WINDOW_IDS.has(id)) {
      return false;
    }
    return true;
  });
  const visibleWindowsWithMini = visibleWindows.filter((id) =>
    Boolean(windows.getWindowMiniContent(id)),
  );
  const isEmpty = visibleWindows.length === 0;
  // A fill window fills the dock only while it's alone there, which needs the
  // stack to have an explicit height. Sharing the dock, it shows all of itself
  // like the others and the column scrolls as one, so nothing is squeezed into
  // a box too small to look scrollable.
  const fillsDock =
    visibleWindows.length === 1 &&
    Boolean(windows.getWindowById(visibleWindows[0])?.fillDockHeight);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

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

  // The dock's scrollbar only shows on hover, so a fade along its bottom says
  // there's more below.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || collapsed || isEmpty) return;
    const update = () =>
      setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [collapsed, isEmpty]);

  if (isEmpty) return null;

  const setRef = (element: HTMLDivElement | null) => {
    containerRef.current = element;
    registerDockAreaElement(side, element);
  };

  const handleToggleCollapse = () => {
    windows.toggleDockAreaCollapsed(side);
  };

  const shouldSnap = (attemptedWidth: number) =>
    collapsed
      ? attemptedWidth >= DOCK_AREA_EXPAND_SNAP_THRESHOLD
      : attemptedWidth <= DOCK_AREA_COLLAPSE_SNAP_THRESHOLD;

  const handleResize = (attemptedWidth: number) => {
    setSnapPreview(
      shouldSnap(attemptedWidth) ? (collapsed ? "expand" : "collapse") : null,
    );
  };

  const handleResizeEnd = (attemptedWidth: number) => {
    setSnapPreview(null);
    if (shouldSnap(attemptedWidth)) {
      windows.toggleDockAreaCollapsed(side);
    }
  };

  const handleSide = side === "left" ? "right" : "left";

  if (collapsed) {
    return (
      <div
        ref={setRef}
        data-dock-area={side}
        className={cn("relative shrink-0 bg-muted flex flex-col")}
        style={{ width: COLLAPSED_DOCK_AREA_WIDTH }}
      >
        {snapPreview === "expand" && (
          <div
            aria-hidden="true"
            data-dock-resize-preview="expand"
            className={cn(
              "absolute inset-y-0 z-10 pointer-events-none bg-card/75",
              "border-primary/40 ring-1 ring-primary/30 shadow-2xl",
              side === "left" ? "left-0 border-r" : "right-0 border-l",
            )}
            style={{ width: dockArea.width }}
          />
        )}
        <BlockStack
          gap="1"
          align="center"
          className="relative z-20 min-h-0 flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar py-1 px-0.5"
        >
          {visibleWindowsWithMini.map((windowId) =>
            windows.getWindowById(windowId)?.renderMiniInline ? (
              <div key={windowId} className="w-full shrink-0">
                {windows.getWindowMiniContent(windowId)}
              </div>
            ) : (
              <CollapsedDockWindowMini
                key={windowId}
                windowId={windowId}
                dockSide={side}
              />
            ),
          )}
        </BlockStack>
        <VerticalResizeHandle
          side={handleSide}
          minWidth={COLLAPSED_DOCK_AREA_WIDTH}
          maxWidth={COLLAPSED_DOCK_AREA_WIDTH}
          onDoubleClick={handleToggleCollapse}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      </div>
    );
  }

  return (
    <div
      ref={setRef}
      data-dock-area={side}
      className={cn("relative shrink-0 bg-card")}
      style={{ width: dockArea.width }}
    >
      {snapPreview === "collapse" && (
        <div
          aria-hidden="true"
          data-dock-resize-preview="collapse"
          className="absolute inset-0 z-20 pointer-events-none bg-background/60 backdrop-blur-[1px]"
        >
          <div
            className={cn(
              "absolute inset-y-0 w-9 bg-primary/15 border-primary/40 shadow-xl",
              side === "left" ? "left-0 border-r" : "right-0 border-l",
            )}
          />
        </div>
      )}
      <div
        ref={scrollRef}
        data-dock-scroll
        className="absolute inset-0 overflow-y-auto overflow-x-hidden reveal-scrollbar"
      >
        <BlockStack className={cn(fillsDock ? "h-full" : "min-h-full")}>
          {visibleWindows.map((windowId, index) => (
            <Window
              key={windowId}
              windowId={windowId}
              docked
              dockIndex={index}
              fillsDock={fillsDock}
              quietHeader={quietHeaders}
            />
          ))}
        </BlockStack>
      </div>
      {moreBelow && (
        <div
          aria-hidden="true"
          data-dock-more-below
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-linear-to-t from-card to-transparent"
        />
      )}

      <VerticalResizeHandle
        side={handleSide}
        minWidth={MIN_DOCK_AREA_WIDTH}
        maxWidth={MAX_DOCK_AREA_WIDTH}
        onDoubleClick={handleToggleCollapse}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />
    </div>
  );
});
