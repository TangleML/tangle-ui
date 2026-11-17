import { observer } from "mobx-react-lite";

import { Tabs, TabsContent, TabStrip } from "@/components/ui/tabs";
import { CloseableTabTrigger } from "@/routes/v2/pages/Tangent/components/CloseableTabTrigger";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { MIN_WORKAREA_WIDTH } from "@/routes/v2/pages/Tangent/layout";
import { getWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type { WorkareaHostProps } from "@/routes/v2/pages/Tangent/workarea/types";

import { CanvasEmptyState } from "./CanvasEmptyState";
import { ProjectDockPopover } from "./ProjectDockPopover";

/**
 * The right-hand "Dynamic Workarea": a tabbed surface people and Tangent agents
 * fill with the right view for the task. Each tab's view is resolved through
 * the workarea registry, so the shell never switches on a concrete view's
 * internals — it only reads the kind's `icon`, `keepMounted`, and `render`.
 *
 * A `keepMounted` view mounts the first time its tab is shown and then stays
 * mounted while inactive (hidden via CSS), so a live view survives background
 * switches without every tab a project comes back with loading at once. Other
 * views mount only when active.
 */
export const DynamicWorkarea = observer(function DynamicWorkarea() {
  const store = useTangentProject();
  const activeSessionId = store.activeSessionId;
  const workareaTabs = store.workareaTabs;
  const activeWorkareaTabId = store.activeWorkareaTabId;
  const tangentBaseUrl = store.tangentBaseUrl;
  function hostPropsFor(tabId: string): WorkareaHostProps {
    return {
      isActive: tabId === activeWorkareaTabId,
      projectId: store.projectId,
      sessionId: activeSessionId,
      tangentBaseUrl,
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
      className="relative flex h-full min-w-0 flex-1 flex-col bg-card"
      style={{ minWidth: MIN_WORKAREA_WIDTH }}
    >
      <Tabs
        value={activeWorkareaTabId ?? ""}
        onValueChange={(id) => store.selectWorkareaTab(id)}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <TabStrip trailing={<ProjectDockPopover />}>
          {workareaTabs.map((tab) => (
            <CloseableTabTrigger
              key={tab.id}
              value={tab.id}
              title={tab.title}
              icon={getWorkareaKind(tab.target.type)?.icon ?? "FileText"}
              onClose={() => store.closeWorkareaTab(tab.id)}
            />
          ))}
        </TabStrip>
        {workareaTabs.length > 0 ? (
          workareaTabs.map((tab) => {
            const viewKind = getWorkareaKind(tab.target.type);
            if (!viewKind) return null;
            if (viewKind.keepMounted && !store.hasShownTab(tab.id)) return null;
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
          })
        ) : (
          <CanvasEmptyState />
        )}
      </Tabs>
    </div>
  );
});
