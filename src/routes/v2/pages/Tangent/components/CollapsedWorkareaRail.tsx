import { observer } from "mobx-react-lite";
import { type Ref, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  MIN_WORKAREA_WIDTH,
  WORKAREA_ID,
} from "@/routes/v2/pages/Tangent/layout";
import { workareaTabIcon } from "@/routes/v2/pages/Tangent/workarea/workareaTabIcon";
import {
  COLLAPSED_DOCK_AREA_WIDTH,
  DOCK_AREA_EXPAND_SNAP_THRESHOLD,
} from "@/routes/v2/shared/windows/types";

interface RailButtonProps {
  label: string;
  icon: IconName;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}

function RailButton({ label, icon, onClick, ref }: RailButtonProps) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className="size-7 text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <Icon name={icon} size="sm" />
    </Button>
  );
}

export const CollapsedWorkareaRail = observer(function CollapsedWorkareaRail() {
  const store = useTangentProject();
  const [expandPreview, setExpandPreview] = useState(false);
  const showButton = useRef<HTMLButtonElement | null>(null);

  // Hiding the workarea strands any focus inside it; land it on the rail.
  useEffect(() => {
    const focused = document.activeElement;
    const workarea = document.getElementById(WORKAREA_ID);
    if (!focused || focused === document.body || workarea?.contains(focused))
      showButton.current?.focus();
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
        <RailButton
          ref={showButton}
          label="Show workarea"
          icon="PanelRightOpen"
          onClick={() => store.showWorkarea()}
        />
        {store.workareaTabs.map((tab) => (
          <RailButton
            key={tab.id}
            label={`Show ${tab.title}`}
            icon={workareaTabIcon(tab)}
            onClick={() => {
              store.selectWorkareaTab(tab.id);
              store.showWorkarea();
            }}
          />
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
