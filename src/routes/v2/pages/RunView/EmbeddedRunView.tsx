import "@xyflow/react/dist/style.css";

import { ReactFlowProvider } from "@xyflow/react";
import { useRef, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { RunSubmissionScopeProvider } from "@/providers/RunSubmissionScopeProvider";
import { useReadOnlySpecLifecycle } from "@/routes/v2/shared/hooks/useReadOnlySpecLifecycle";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  type SharedUIStore,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { SharedStoreRegistrar } from "@/routes/v2/shared/store/SharedStoreRegistrar";

import { RunViewLoadStateFallback } from "./components/RunViewLoadStateFallback";
import { RunViewViewport } from "./components/RunViewViewport";
import { useEmbeddedRunViewInitialDockLayout } from "./hooks/useEmbeddedRunViewInitialDockLayout";
import { useRunViewLoadState } from "./hooks/useRunViewLoadState";
import { useRunViewSelectionSync } from "./hooks/useRunViewSelectionSync";
import { useRunViewSubgraphExecutionSync } from "./hooks/useRunViewSubgraphUrlSync";
import { useRunViewWindows } from "./hooks/useRunViewWindows";
import { TangentRunAgentProvider } from "./TangentRunAgentProvider";

interface EmbeddedRunViewProps {
  runId: string;
  isActive: boolean;
  projectId: string;
  onStoreReady?: (store: SharedUIStore) => void;
  onStoreClosed?: () => void;
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

interface RunAgentBoundaryProps {
  runId: string;
  subgraphExecutionId?: string;
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

/**
 * Hosts the Tangent run-inspector sub-agent only when this run view is embedded
 * in a Tangent session. The standalone `/runs` route renders without a
 * `sessionId`, so it stays entirely agent-free.
 */
function RunAgentBoundary({ sessionId, ...rest }: RunAgentBoundaryProps) {
  if (!sessionId) return null;
  return <TangentRunAgentProvider sessionId={sessionId} {...rest} />;
}

interface EmbeddedRunViewLayoutProps extends RunAgentBoundaryProps {
  spec: ComponentSpec;
  isActive: boolean;
  onSubgraphExecutionIdChange: (executionId: string | undefined) => void;
}

function EmbeddedRunViewLayout({
  spec,
  isActive,
  onSubgraphExecutionIdChange,
  ...agentBoundaryProps
}: EmbeddedRunViewLayoutProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useReadOnlySpecLifecycle(spec);
  useShortcutListener(isActive);
  useRunViewWindows({ offersTangentHandoff: false });
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

  return (
    <RunViewViewport canvasRef={canvasRef}>
      <RunAgentBoundary {...agentBoundaryProps} />
    </RunViewViewport>
  );
}

interface EmbeddedRunViewContentProps extends RunAgentBoundaryProps {
  isActive: boolean;
  onSubgraphExecutionIdChange: (executionId: string | undefined) => void;
}

function EmbeddedRunViewContent({
  runId,
  isActive,
  onSubgraphExecutionIdChange,
  ...agentBoundaryProps
}: EmbeddedRunViewContentProps) {
  const loadState = useRunViewLoadState(runId);

  if (loadState.status === "spec") {
    return (
      <EmbeddedRunViewLayout
        spec={loadState.spec}
        isActive={isActive}
        runId={runId}
        onSubgraphExecutionIdChange={onSubgraphExecutionIdChange}
        {...agentBoundaryProps}
      />
    );
  }

  return <RunViewLoadStateFallback state={loadState} />;
}

/**
 * Embeds the run canvas (e.g. inside the Tangent workarea) with only the
 * providers the run content requires. Unlike the standalone `RunView`, it
 * omits the run menu bar and the AI chat window, and keeps an isolated
 * `SharedStoreProvider` so its dock windows don't collide with the surrounding
 * project's windows.
 *
 * Subgraph navigation is tracked in local state (not the page URL) and fed into
 * `ExecutionDataProvider`, so entering a subgraph re-scopes execution status
 * and artifacts without navigating away from the host page.
 */
export function EmbeddedRunView({
  runId,
  isActive,
  projectId,
  onStoreReady,
  onStoreClosed,
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: EmbeddedRunViewProps) {
  const [subgraphExecutionId, setSubgraphExecutionId] = useState<
    string | undefined
  >(undefined);

  return (
    <RunSubmissionScopeProvider projectId={projectId}>
      <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
        <SharedStoreProvider>
          <SharedStoreRegistrar
            onReady={onStoreReady}
            onClosed={onStoreClosed}
          />
          <ReactFlowProvider>
            <ExecutionDataProvider
              pipelineRunId={runId}
              subgraphExecutionId={subgraphExecutionId}
            >
              <ComponentLibraryProvider>
                <EmbeddedRunViewContent
                  runId={runId}
                  isActive={isActive}
                  subgraphExecutionId={subgraphExecutionId}
                  sessionId={sessionId}
                  environmentId={environmentId}
                  onEnvironmentReady={onEnvironmentReady}
                  onEnvironmentClosed={onEnvironmentClosed}
                  onBridgeReady={onBridgeReady}
                  onBridgeClosed={onBridgeClosed}
                  onSubgraphExecutionIdChange={setSubgraphExecutionId}
                />
              </ComponentLibraryProvider>
            </ExecutionDataProvider>
          </ReactFlowProvider>
        </SharedStoreProvider>
      </div>
    </RunSubmissionScopeProvider>
  );
}
