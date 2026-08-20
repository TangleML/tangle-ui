import { ArtifactViewer } from "@tangent/embed-react";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";
import type { WorkareaTab } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { CloseableTabTrigger } from "@/routes/v2/shared/tangent/CloseableTabTrigger";

const DEFAULT_WIDTH = 960;
const MIN_WIDTH = 320;
const MAX_WIDTH = 960;

/** Stable, per-tab remote-env id so the server can route spawns to this editor. */
function pipelineEnvironmentId(sessionId: string, tabId: string): string {
  return `${sessionId}:${tabId}`;
}

function WorkareaArtifactBody({
  tab,
  sessionId,
}: {
  tab: Extract<WorkareaTab, { kind: "artifact" }>;
  sessionId: string | undefined;
}) {
  if (sessionId === undefined) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6 text-center"
      >
        <Text size="sm" tone="subdued">
          Start a session to view this artifact.
        </Text>
      </BlockStack>
    );
  }
  return (
    <ArtifactViewer
      sessionId={sessionId}
      url={tab.url}
      title={tab.title}
      className="min-h-0 flex-1"
      style={{ height: "100%" }}
    />
  );
}

/**
 * The right-hand "Dynamic Workarea": a tabbed surface people and Tangent agents
 * fill with the right view for the task. Each tab is either an embedded pipeline
 * editor canvas or a Tangent artifact viewer.
 *
 * Pipeline tabs are kept mounted (via `forceMount`, hidden when inactive) so
 * each one's per-tab editor agent stays connected even in the background —
 * letting a Tangent agent drive several open pipelines at once. Artifact tabs
 * mount lazily since they hold no live agent.
 */
export function DynamicWorkarea() {
  const {
    workareaTabs,
    activeWorkareaTabId,
    activeSessionId,
    selectWorkareaTab,
    closeWorkareaTab,
    registerTabEnvironment,
    unregisterTabEnvironment,
    registerTabBridge,
    unregisterTabBridge,
  } = useTangentProject();
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  function handleResizeEnd(attemptedWidth: number) {
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, attemptedWidth)));
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
                icon={tab.kind === "pipeline" ? "Workflow" : "FileText"}
                onClose={() => closeWorkareaTab(tab.id)}
              />
            ))}
          </TabsList>
          {workareaTabs.map((tab) => {
            if (tab.kind === "pipeline") {
              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  forceMount
                  className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                >
                  <EmbeddedPipelineEditor
                    pipelineRef={tab.pipelineRef}
                    sessionId={activeSessionId}
                    environmentId={
                      activeSessionId
                        ? pipelineEnvironmentId(activeSessionId, tab.id)
                        : undefined
                    }
                    onEnvironmentReady={(environmentId) =>
                      registerTabEnvironment(tab.id, environmentId)
                    }
                    onEnvironmentClosed={() => unregisterTabEnvironment(tab.id)}
                    onBridgeReady={(bridge) =>
                      registerTabBridge(tab.id, bridge)
                    }
                    onBridgeClosed={() => unregisterTabBridge(tab.id)}
                  />
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
                <WorkareaArtifactBody tab={tab} sessionId={activeSessionId} />
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
            Tangent will open pipelines, artifacts, and runs here as you work.
          </Text>
        </BlockStack>
      )}
    </div>
  );
}
