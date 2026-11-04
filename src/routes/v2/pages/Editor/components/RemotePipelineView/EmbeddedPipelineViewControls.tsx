import { Panel } from "@xyflow/react";
import type { PropsWithChildren } from "react";

import { AiModelQuickSelect } from "@/components/layout/AiModelQuickSelect";
import { Badge } from "@/components/ui/badge";
import { InlineStack } from "@/components/ui/layout";

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
        <Badge size="sm" className="shrink-0">
          View only
        </Badge>
        <InlineStack wrap="nowrap" blockAlign="center">
          {children}
        </InlineStack>
        <AiModelQuickSelect />
      </InlineStack>
    </Panel>
  );
}
