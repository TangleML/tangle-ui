import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import {
  SCROLLING_TAB_STRIP,
  Tabs,
  TabsContent,
  TabsList,
} from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { CloseableTabTrigger } from "@/routes/v2/pages/Tangent/components/CloseableTabTrigger";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  MIN_WORKAREA_WIDTH,
  WORKAREA_ID,
} from "@/routes/v2/pages/Tangent/layout";
import { getWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type { WorkareaHostProps } from "@/routes/v2/pages/Tangent/workarea/types";
import { workareaTabIcon } from "@/routes/v2/pages/Tangent/workarea/workareaTabIcon";

interface DynamicWorkareaProps {
  collapsePreview?: boolean;
}

/**
 * The right-hand "Dynamic Workarea": a tabbed surface people and Tangent agents
 * fill with the right view for the task. Each tab's view is resolved through
 * the workarea registry, so the shell never switches on a concrete view's
 * internals — it only reads the kind's `icon`, `keepMounted`, and `render`.
 *
 * A `keepMounted` view stays mounted while inactive (hidden via CSS) so a live
 * view survives background switches; other views mount only when active.
 */
export const DynamicWorkarea = observer(function DynamicWorkarea({
  collapsePreview = false,
}: DynamicWorkareaProps) {
  const store = useTangentProject();
  const activeSessionId = store.activeSessionId;
  const workareaTabs = store.workareaTabs;
  const activeWorkareaTabId = store.activeWorkareaTabId;
  function hostPropsFor(tabId: string): WorkareaHostProps {
    const isSelected = tabId === activeWorkareaTabId;
    return {
      isSelected,
      isActive: !store.workareaCollapsed && isSelected,
      projectId: store.projectId,
      sessionId: activeSessionId,
      registerTabStore: (id, tabStore) => store.registerTabStore(id, tabStore),
      unregisterTabStore: (id) => store.unregisterTabStore(id),
      // A stable per-tab remote-env id so the server can route spawns to this tab.
      tabEnvironmentId: (id) =>
        activeSessionId ? `${activeSessionId}:${id}` : undefined,
      registerTabEnvironment: (id, environmentId) =>
        store.registerTabEnvironment(id, environmentId),
      unregisterTabEnvironment: (id) => store.unregisterTabEnvironment(id),
      registerTabBridge: (id, kind, bridge) =>
        store.registerTabBridge(id, kind, bridge),
      unregisterTabBridge: (id) => store.unregisterTabBridge(id),
    };
  }

  return (
    <div
      id={WORKAREA_ID}
      hidden={store.workareaCollapsed}
      className="relative flex h-full min-w-0 flex-1 flex-col border-l border-border bg-card"
      style={{ minWidth: MIN_WORKAREA_WIDTH }}
    >
      {collapsePreview && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 bg-background/60 backdrop-blur-[1px]"
        >
          <div className="absolute inset-y-0 right-0 w-9 border-l border-primary/40 bg-primary/15 shadow-xl" />
        </div>
      )}
      {workareaTabs.length > 0 ? (
        <Tabs
          value={activeWorkareaTabId ?? undefined}
          onValueChange={(id) => store.selectWorkareaTab(id)}
          className="flex h-full min-h-0 flex-col gap-1"
        >
          <TabsList
            className={cn(
              "max-w-full shrink-0 rounded-none border-b border-border bg-card",
              SCROLLING_TAB_STRIP,
            )}
          >
            {workareaTabs.map((tab) => (
              <CloseableTabTrigger
                key={tab.id}
                value={tab.id}
                title={tab.title}
                icon={workareaTabIcon(tab)}
                onClose={() => store.closeWorkareaTab(tab.id)}
              />
            ))}
          </TabsList>
          {workareaTabs.map((tab) => {
            const viewKind = getWorkareaKind(tab.target.type);
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
});
