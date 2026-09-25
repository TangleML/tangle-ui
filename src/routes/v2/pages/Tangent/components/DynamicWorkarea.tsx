import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { CloseableTabTrigger } from "@/routes/v2/pages/Tangent/components/CloseableTabTrigger";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { getWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type { WorkareaHostProps } from "@/routes/v2/pages/Tangent/workarea/types";

const DEFAULT_WIDTH = 960;
const MIN_WIDTH = 320;
const MAX_WIDTH = 960;

/**
 * The right-hand "Dynamic Workarea": a tabbed surface people and Tangent agents
 * fill with the right view for the task. Each tab's view is resolved through
 * the workarea registry, so the shell never switches on a concrete view's
 * internals — it only reads the kind's `icon`, `keepMounted`, and `render`.
 *
 * A `keepMounted` view stays mounted while inactive (hidden via CSS) so a live
 * view survives background switches; other views mount only when active.
 */
export function DynamicWorkarea() {
  const {
    workareaTabs,
    activeWorkareaTabId,
    activeSessionId,
    selectWorkareaTab,
    closeWorkareaTab,
    registerWorkareaTabStore,
    unregisterWorkareaTabStore,
  } = useTangentProject();
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  function handleResizeEnd(attemptedWidth: number) {
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, attemptedWidth)));
  }

  function hostPropsFor(tabId: string): WorkareaHostProps {
    return {
      isActive: tabId === activeWorkareaTabId,
      sessionId: activeSessionId,
      registerTabStore: registerWorkareaTabStore,
      unregisterTabStore: unregisterWorkareaTabStore,
    };
  }

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
      style={{ width }}
    >
      <VerticalResizeHandle
        side="left"
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
        onResizeEnd={handleResizeEnd}
      />
      {workareaTabs.length > 0 ? (
        <Tabs
          value={activeWorkareaTabId ?? undefined}
          onValueChange={selectWorkareaTab}
          className="flex h-full min-h-0 flex-col gap-1"
        >
          <TabsList className="max-w-full shrink-0 overflow-x-auto rounded-none border-b border-border bg-card">
            {workareaTabs.map((tab) => (
              <CloseableTabTrigger
                key={tab.id}
                value={tab.id}
                title={tab.title}
                icon={getWorkareaKind(tab.kind)?.icon ?? "FileText"}
                onClose={() => closeWorkareaTab(tab.id)}
              />
            ))}
          </TabsList>
          {workareaTabs.map((tab) => {
            const viewKind = getWorkareaKind(tab.kind);
            if (!viewKind) return null;
            const content = viewKind.render(tab, hostPropsFor(tab.id));
            if (viewKind.keepMounted) {
              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  forceMount
                  className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                >
                  {content}
                </TabsContent>
              );
            }
            if (tab.id !== activeWorkareaTabId) return null;
            return (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="flex min-h-0 flex-1 flex-col"
              >
                {content}
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <BlockStack
          gap="2"
          align="center"
          className="min-h-0 flex-1 justify-center p-6 text-center"
        >
          <Icon
            name="LayoutTemplate"
            size="lg"
            className="text-muted-foreground"
          />
          <Text size="sm" weight="semibold">
            Nothing open yet
          </Text>
          <Text size="sm" tone="subdued">
            Tangent will open artifacts here as you work.
          </Text>
        </BlockStack>
      )}
    </div>
  );
}
