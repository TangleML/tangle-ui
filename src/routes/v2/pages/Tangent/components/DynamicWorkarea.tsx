import { observer } from "mobx-react-lite";
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
export const DynamicWorkarea = observer(function DynamicWorkarea() {
  const store = useTangentProject();
  const activeSessionId = store.activeSessionId;
  const workareaTabs = store.workareaTabs;
  const activeWorkareaTabId = store.activeWorkareaTabId;
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  function handleResizeEnd(attemptedWidth: number) {
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, attemptedWidth)));
  }

  const hostProps: WorkareaHostProps = {
    sessionId: activeSessionId,
    registerTabStore: (tabId, tabStore) =>
      store.registerTabStore(tabId, tabStore),
    unregisterTabStore: (tabId) => store.unregisterTabStore(tabId),
    // A stable per-tab remote-env id so the server can route spawns to this tab.
    tabEnvironmentId: (tabId) =>
      activeSessionId ? `${activeSessionId}:${tabId}` : undefined,
    registerTabEnvironment: (tabId, environmentId) =>
      store.registerTabEnvironment(tabId, environmentId),
    unregisterTabEnvironment: (tabId) => store.unregisterTabEnvironment(tabId),
    registerTabBridge: (tabId, kind, bridge) =>
      store.registerTabBridge(tabId, kind, bridge),
    unregisterTabBridge: (tabId) => store.unregisterTabBridge(tabId),
  };

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
          onValueChange={(id) => store.selectWorkareaTab(id)}
          className="flex h-full min-h-0 flex-col gap-1"
        >
          <TabsList className="max-w-full shrink-0 overflow-x-auto rounded-none border-b border-border bg-card">
            {workareaTabs.map((tab) => (
              <CloseableTabTrigger
                key={tab.id}
                value={tab.id}
                title={tab.title}
                icon={getWorkareaKind(tab.target.type)?.icon ?? "FileText"}
                onClose={() => store.closeWorkareaTab(tab.id)}
              />
            ))}
          </TabsList>
          {workareaTabs.map((tab) => {
            const viewKind = getWorkareaKind(tab.target.type);
            if (!viewKind) return null;
            const content = viewKind.render(tab, hostProps);
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
});
