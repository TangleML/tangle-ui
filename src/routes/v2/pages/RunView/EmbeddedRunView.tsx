import "@xyflow/react/dist/style.css";

import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";

import { InlineStack } from "@/components/ui/layout";
import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  type SharedUIStore,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { SharedStoreRegistrar } from "@/routes/v2/shared/store/SharedStoreRegistrar";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";

import { RunViewFlowCanvas } from "./components/RunViewFlowCanvas";
import { RunViewLoadStateFallback } from "./components/RunViewLoadStateFallback";
import { useEmbeddedRunViewInitialDockLayout } from "./hooks/useEmbeddedRunViewInitialDockLayout";
import { useRunViewLoadState } from "./hooks/useRunViewLoadState";
import { useRunViewSelectionSync } from "./hooks/useRunViewSelectionSync";
import { useRunViewSpecLifecycle } from "./hooks/useRunViewSpecLifecycle";
import { useRunViewSubgraphExecutionSync } from "./hooks/useRunViewSubgraphUrlSync";
import { useRunViewWindows } from "./hooks/useRunViewWindows";
import { runViewRegistry } from "./nodes";

interface EmbeddedRunViewProps {
  runId: string;
  onStoreReady?: (store: SharedUIStore) => void;
  onStoreClosed?: () => void;
}

interface EmbeddedRunViewLayoutProps {
  spec: ComponentSpec;
  onSubgraphExecutionIdChange: (executionId: string | undefined) => void;
}

const EmbeddedRunViewLayout = observer(function EmbeddedRunViewLayout({
  spec,
  onSubgraphExecutionIdChange,
}: EmbeddedRunViewLayoutProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useRunViewSpecLifecycle(spec);
  useShortcutListener();
  useRunViewWindows();
  useEmbeddedRunViewInitialDockLayout();
  useRunViewSelectionSync({
    contextPanel: {
      defaultDockState: undefined,
      getInitialPosition: () => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: window.innerWidth - 340, y: 80 };
        return { x: rect.right - 300 - 12, y: rect.top + 12 };
      },
    },
  });
  useRunViewSubgraphExecutionSync(onSubgraphExecutionIdChange);

  const { navigation } = useSharedStores();
  const activeSpec = navigation.activeSpec;

  if (!activeSpec) return null;

  return (
    <NodeRegistryProvider registry={runViewRegistry}>
      <SpecProvider spec={activeSpec}>
        <InlineStack
          className="flex-1 min-h-0 w-full"
          blockAlign="stretch"
          wrap="nowrap"
          data-testid="run-view-v2"
        >
          <div ref={canvasRef} className="relative flex-1 min-w-0 h-full">
            <RunViewFlowCanvas
              key={activeSpec?.$id ?? "root"}
              spec={activeSpec}
              className="h-full"
            />
            <WindowContainer />
          </div>
          <DockArea side="right" />
        </InlineStack>
      </SpecProvider>
    </NodeRegistryProvider>
  );
});

interface EmbeddedRunViewContentProps {
  runId: string;
  onSubgraphExecutionIdChange: (executionId: string | undefined) => void;
}

const EmbeddedRunViewContent = observer(function EmbeddedRunViewContent({
  runId,
  onSubgraphExecutionIdChange,
}: EmbeddedRunViewContentProps) {
  const loadState = useRunViewLoadState(runId);

  if (loadState.status === "spec") {
    return (
      <EmbeddedRunViewLayout
        spec={loadState.spec}
        onSubgraphExecutionIdChange={onSubgraphExecutionIdChange}
      />
    );
  }

  return <RunViewLoadStateFallback state={loadState} />;
});

/**
 * Embeds the run canvas (e.g. inside the Tangent workarea) with only the
 * providers the run content requires. Unlike the standalone `RunViewV2`, it
 * omits the run menu bar and the AI chat window, and keeps an isolated
 * `SharedStoreProvider` so its dock windows don't collide with the surrounding
 * project's windows.
 *
 * Subgraph navigation is tracked in local state (not the page URL) and fed into
 * `ExecutionDataProvider`, so entering a subgraph re-scopes execution status
 * and artifacts without navigating away from the host page. It also nests its
 * own `ComponentSpecProvider` so multiple open run tabs don't clobber the
 * app-level singleton (or each other's subgraph path).
 */
export function EmbeddedRunView({
  runId,
  onStoreReady,
  onStoreClosed,
}: EmbeddedRunViewProps) {
  const [subgraphExecutionId, setSubgraphExecutionId] = useState<
    string | undefined
  >(undefined);

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <SharedStoreRegistrar onReady={onStoreReady} onClosed={onStoreClosed} />
        <ComponentSpecProvider>
          <ReactFlowProvider>
            <ContextPanelProvider>
              <ExecutionDataProvider
                pipelineRunId={runId}
                subgraphExecutionId={subgraphExecutionId}
              >
                <ComponentLibraryProvider>
                  <EmbeddedRunViewContent
                    runId={runId}
                    onSubgraphExecutionIdChange={setSubgraphExecutionId}
                  />
                </ComponentLibraryProvider>
              </ExecutionDataProvider>
            </ContextPanelProvider>
          </ReactFlowProvider>
        </ComponentSpecProvider>
      </SharedStoreProvider>
    </div>
  );
}
