import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  MIN_WORKAREA_WIDTH,
  WORKAREA_ID,
} from "@/routes/v2/pages/Tangent/layout";
import { getWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import {
  COLLAPSED_DOCK_AREA_WIDTH,
  DOCK_AREA_EXPAND_SNAP_THRESHOLD,
} from "@/routes/v2/shared/windows/types";

/**
 * The collapsed workarea, shaped like the left dock's collapsed rail: a narrow
 * strip of the open tabs. Double-clicking or dragging its edge out reopens the
 * workarea, and each tab icon reopens it on that tab.
 */
export const CollapsedWorkareaRail = observer(function CollapsedWorkareaRail() {
  const store = useTangentProject();
  const [expandPreview, setExpandPreview] = useState(false);
  const firstButton = useRef<HTMLButtonElement | null>(null);

  // Hiding the workarea strands any focus inside it; land it on the rail.
  useEffect(() => {
    const focused = document.activeElement;
    const workarea = document.getElementById(WORKAREA_ID);
    if (!focused || focused === document.body || workarea?.contains(focused))
      firstButton.current?.focus();
  }, []);

  const shouldExpand = (attemptedWidth: number) =>
    attemptedWidth >= DOCK_AREA_EXPAND_SNAP_THRESHOLD;

  return (
    <div
      className="relative flex shrink-0 flex-col border-l border-border bg-muted"
      style={{ width: COLLAPSED_DOCK_AREA_WIDTH }}
    >
      {expandPreview && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 border-l border-primary/40 bg-card/75 shadow-2xl ring-1 ring-primary/30"
          style={{ width: MIN_WORKAREA_WIDTH }}
        />
      )}
      <BlockStack
        gap="1"
        align="center"
        className="hide-scrollbar relative z-20 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-0.5 py-1"
      >
        <Button
          ref={firstButton}
          variant="ghost"
          size="icon"
          aria-label="Show workarea"
          title="Show workarea"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => store.showWorkarea()}
        >
          <Icon name="PanelRightOpen" size="sm" />
        </Button>
        {store.workareaTabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="icon"
            aria-label={`Show ${tab.title}`}
            title={tab.title}
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              store.selectWorkareaTab(tab.id);
              store.showWorkarea();
            }}
          >
            <Icon
              name={getWorkareaKind(tab.target.type)?.icon ?? "FileText"}
              size="sm"
            />
          </Button>
        ))}
      </BlockStack>
      <VerticalResizeHandle
        side="left"
        label="Expand workarea"
        minWidth={COLLAPSED_DOCK_AREA_WIDTH}
        maxWidth={COLLAPSED_DOCK_AREA_WIDTH}
        onDoubleClick={() => store.showWorkarea()}
        onResize={(width) => setExpandPreview(shouldExpand(width))}
        onResizeEnd={(width) => {
          setExpandPreview(false);
          if (shouldExpand(width)) store.showWorkarea();
        }}
      />
    </div>
  );
});
