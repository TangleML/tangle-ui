import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { useWindowDrag } from "@/routes/v2/shared/windows/hooks/useWindowDrag";
import { SnapPreview } from "@/routes/v2/shared/windows/SnapPreview";
import {
  DEFAULT_DOCKED_HEIGHT,
  DOCKED_HEADER_HEIGHT as HEADER_HEIGHT,
} from "@/routes/v2/shared/windows/types";

import { FoldButton } from "./FoldButton";
import { WindowActions } from "./WindowActions";
import { WindowHeader } from "./WindowHeader";

export const DockedWindow = observer(function DockedWindow() {
  const {
    model,
    content,
    dockIndex = 0,
    fillsDock = false,
    quietHeader = false,
  } = useWindowContext();
  const { track } = useAnalytics();

  const {
    isDragging,
    snapPreview,
    panelRef,
    handleHeaderMouseDown,
    handleContainerMouseDown,
    handleContainerClick,
  } = useWindowDrag({ docked: true });

  const [isResizing, setIsResizing] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const stickyTop = dockIndex * HEADER_HEIGHT;

  // Detect when the header is in its "stuck" state
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { rootMargin: `-${stickyTop + 1}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [stickyTop]);

  const handleResizeMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    // In fit-to-content mode (no explicit height) measure the current rendered
    // height so the drag continues seamlessly from where the content sits.
    const startHeight =
      model.dockedHeight ??
      contentRef.current?.getBoundingClientRect().height ??
      DEFAULT_DOCKED_HEIGHT;

    const onMouseMove = (moveE: MouseEvent) => {
      const newHeight = Math.max(
        model.minDockedHeight,
        startHeight + (moveE.clientY - startY),
      );
      model.updateDockedHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleScrollToWindow = () => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const actions = <WindowActions />;
  const showCollapsedStyle = model.isMinimized || isStuck;
  const fitsContent = !fillsDock && model.dockedHeight === undefined;

  if (model.isMaximized) {
    return createPortal(
      <div
        ref={panelRef}
        className="fixed inset-0 z-45 bg-muted text-foreground flex flex-col rounded-none overflow-hidden"
        onMouseDown={handleContainerMouseDown}
        onClick={handleContainerClick}
      >
        <WindowHeader
          title={model.title}
          leadingIcon={
            <Icon
              name="PanelLeft"
              size="xs"
              className="text-muted-foreground shrink-0"
            />
          }
          actions={actions}
          className="bg-card"
        />
        <div className="reveal-scrollbar flex-1 min-h-0 overflow-auto bg-background">
          {content}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Collapsible
      className="contents"
      open={!model.isMinimized}
      onOpenChange={(shouldExpand) => {
        const isExpanded = !model.isMinimized;
        if (shouldExpand === isExpanded) return;
        track("v2.shared_window.docked_panel_toggle_completed", {
          panel_expanded: shouldExpand,
        });
        model.toggleMinimize();
      }}
    >
      {/* Sentinel to detect stuck state and serve as scroll target */}
      <div ref={sentinelRef} className="h-0 w-full shrink-0" />

      {/* Header is a direct flex item of the dock scroll container so sticky works */}
      <CollapsibleTrigger asChild>
        <div
          ref={panelRef}
          data-dock-window={model.id}
          data-window-id={model.id}
          className={cn(
            "group/window w-full sticky text-left shrink-0",
            (isDragging || isResizing) && "select-none",
            isDragging && "cursor-grabbing opacity-50",
            quietHeader
              ? cn(
                  "bg-card border-b border-transparent",
                  isStuck && "border-b-border",
                )
              : showCollapsedStyle
                ? "bg-card bg-linear-to-b from-edge-selected/10 to-edge-selected/10 border-b border-edge-selected/30"
                : "bg-card border-b border-transparent",
          )}
          style={{ top: stickyTop, zIndex: 20 - dockIndex }}
          onMouseDown={handleContainerMouseDown}
          onClick={(e) => {
            handleContainerClick();
            if (isStuck) {
              // Prefer scroll-to-window over toggling collapse when stuck.
              e.preventDefault();
              handleScrollToWindow();
            }
          }}
        >
          <WindowHeader
            title={model.title}
            isDragging={isDragging}
            onMouseDown={handleHeaderMouseDown}
            leadingIcon={
              <Icon
                name="GripVertical"
                size="xs"
                className="text-muted-foreground shrink-0"
              />
            }
            actions={quietHeader ? <QuietHeaderActions /> : actions}
            actionsOnHover={!quietHeader}
            quiet={quietHeader}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent
        className={cn("w-full", fillsDock ? "flex-1 min-h-0" : "shrink-0")}
        // Filling the dock, a window still keeps its minimum height, so a
        // short dock scrolls instead of squeezing it.
        style={fillsDock ? { minHeight: model.minDockedHeight } : undefined}
        data-dock-window-content={model.id}
      >
        <div
          ref={contentRef}
          className={cn(
            "w-full bg-card text-foreground flex flex-col overflow-hidden",
            fillsDock && "h-full",
            (isDragging || isResizing) && "select-none",
            isDragging && "opacity-50",
          )}
          style={{
            // A fill window's minimum is against being squeezed while it
            // fills; sharing the dock, it shows all of itself instead.
            minHeight:
              model.fillDockHeight && !fillsDock
                ? undefined
                : model.minDockedHeight,
            // fillsDock => grow to fill the dock column; otherwise an
            // undefined height fits content and a concrete value fixes the
            // height with the inner content area scrolling.
            height: fillsDock ? undefined : (model.dockedHeight ?? undefined),
            maxHeight: fitsContent ? model.maxDockedHeight : undefined,
          }}
          onMouseDown={handleContainerMouseDown}
          onClick={handleContainerClick}
        >
          <div className="reveal-scrollbar flex-1 min-h-0 overflow-auto bg-card">
            {content}
          </div>
          {!fillsDock && (
            <div
              className="h-1 cursor-ns-resize hover:bg-accent transition-colors shrink-0"
              onMouseDown={handleResizeMouseDown}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                model.resetDockedHeight();
              }}
            />
          )}
        </div>
      </CollapsibleContent>

      {isDragging &&
        snapPreview &&
        createPortal(
          <SnapPreview preview={snapPreview} windowWidth={model.size.width} />,
          document.body,
        )}
    </Collapsible>
  );
});

/** Whether the window is folded stays in view; the rest wait for a hover. */
function QuietHeaderActions() {
  return (
    <div className="flex items-center gap-0.5">
      <div className="opacity-0 transition-opacity duration-200 group-focus-within/window:opacity-100 group-hover/window:opacity-100">
        <WindowActions hideMinimize />
      </div>
      <FoldButton trackingId="v2.shared_window.chrome.fold" />
    </div>
  );
}
