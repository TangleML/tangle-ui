import { Panel } from "@xyflow/react";
import type { PropsWithChildren } from "react";

import { InlineStack } from "@/components/ui/layout";

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
        className="rounded-md border border-white/10 bg-stone-900 px-2 py-1 shadow-md"
      >
        <ReadOnlyBadge />
        <InlineStack wrap="nowrap" blockAlign="center">
          {children}
        </InlineStack>
      </InlineStack>
    </Panel>
  );
}
