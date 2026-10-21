import type { PropsWithChildren } from "react";

import { Badge } from "@/components/ui/badge";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import {
  CanvasHomeLink,
  CanvasMenuBar,
} from "@/routes/v2/shared/components/CanvasMenuBar";

export function RemotePipelineShell({
  name = "Remote pipeline",
  children,
}: PropsWithChildren<{ name?: string }>) {
  return (
    <BlockStack
      fill
      align="stretch"
      inlineAlign="start"
      className="bg-slate-100 dark:bg-background select-none"
    >
      <CanvasMenuBar>
        <InlineStack
          gap="3"
          blockAlign="center"
          wrap="nowrap"
          className="min-w-0"
        >
          <CanvasHomeLink trackingId="v2.pipeline_editor.menubar.home" />
          <Text
            size="sm"
            weight="semibold"
            tone="inverted"
            className="truncate"
          >
            {name}
          </Text>
          <Badge size="sm" className="shrink-0">
            View only
          </Badge>
        </InlineStack>
        <AppMenuActions />
      </CanvasMenuBar>
      {children}
    </BlockStack>
  );
}
