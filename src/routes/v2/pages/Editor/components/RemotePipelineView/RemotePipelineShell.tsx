import type { PropsWithChildren, ReactNode } from "react";

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
  menus,
  children,
}: PropsWithChildren<{ name?: string; menus?: ReactNode }>) {
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
          <BlockStack className="min-w-0">
            <InlineStack
              gap="2"
              blockAlign="center"
              wrap="nowrap"
              className="ml-1 min-w-0"
            >
              <Text
                size="sm"
                weight="semibold"
                className="text-white truncate max-w-64 lg:max-w-md leading-tight"
              >
                {name}
              </Text>
              <Badge size="sm" className="shrink-0">
                View only
              </Badge>
            </InlineStack>
            {menus && (
              <InlineStack wrap="nowrap" blockAlign="center">
                {menus}
              </InlineStack>
            )}
          </BlockStack>
        </InlineStack>
        <InlineStack gap="2" blockAlign="center">
          <AppMenuActions />
        </InlineStack>
      </CanvasMenuBar>
      {children}
    </BlockStack>
  );
}
