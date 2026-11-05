import { Panel } from "@xyflow/react";
import type { PropsWithChildren } from "react";

import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { CANVAS_MENU_SURFACE_CLASS } from "@/routes/v2/shared/components/CanvasMenuBar";

import { ReadOnlyBadge } from "./ReadOnlyBadge";

export function EmbeddedPipelineViewControls({ children }: PropsWithChildren) {
  return (
    <Panel
      position="top-right"
      role="group"
      aria-label="Pipeline view controls"
    >
      <InlineStack
        gap="2"
        blockAlign="center"
        wrap="nowrap"
        className={cn(
          "rounded-md border border-white/10 px-2 py-1 shadow-md",
          CANVAS_MENU_SURFACE_CLASS,
        )}
      >
        <ReadOnlyBadge />
        <InlineStack wrap="nowrap" blockAlign="center">
          {children}
        </InlineStack>
      </InlineStack>
    </Panel>
  );
}
