import "@xyflow/react/dist/style.css";

import { useQueryClient } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useBackend } from "@/providers/BackendProvider";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { createRunViewToolBridge } from "@/routes/v2/pages/RunView/toolBridge/runViewToolBridge";
import {
  SharedStoreProvider,
  type SharedUIStore,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { TangentRemoteEnvProvider } from "@/routes/v2/shared/tangent/TangentRemoteEnvProvider";

import { RunViewContent } from "./RunViewV2";

interface EmbeddedRunViewProps {
  runId: string;
  /**
   * The Tangent session this tab belongs to. When set, a remote sub-agent host
   * is mounted so Prime can spawn a read-only run-inspector sub-agent bound to
   * this run.
   */
  sessionId?: string;
  /**
   * Stable remote-env id for this tab's run-inspector agent, so the server can
   * route spawns to it. Required (with `sessionId`) to host the agent.
   */
  environmentId?: string;
  /** Called with the connected environment id once the agent host connects. */
  onEnvironmentReady?: (environmentId: string) => void;
  /** Called when the agent host disconnects (e.g. tab close / unmount). */
  onEnvironmentClosed?: () => void;
  /** Called with this tab's live bridge so the project agent can drive it. */
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  /** Called when this tab's bridge is no longer live. */
  onBridgeClosed?: () => void;
  /** Called with this tab's live shared store so host chat chips can focus it. */
  onStoreReady?: (store: SharedUIStore) => void;
  /** Called when this tab's shared store is no longer live. */
  onStoreClosed?: () => void;
}

/**
 * Surfaces this run view's isolated {@link SharedUIStore} to the surrounding
 * project (via callbacks) so sibling UI — the embedded chat's entity chips —
 * can navigate and focus this tab's live canvas. Callbacks are read through
 * refs so registration keys off the stable store instance, not callback
 * identity.
 */
function SharedStoreRegistrar({
  onReady,
  onClosed,
}: {
  onReady?: (store: SharedUIStore) => void;
  onClosed?: () => void;
}) {
  const store = useSharedStores();
  const onReadyRef = useRef(onReady);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onReadyRef.current = onReady;
    onClosedRef.current = onClosed;
  });

  useEffect(() => {
    onReadyRef.current?.(store);
    return () => onClosedRef.current?.();
  }, [store]);

  return null;
}

interface RunAgentBoundaryProps {
  sessionId?: string;
  runId: string;
  subgraphExecutionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
  children: ReactNode;
}

/**
 * Builds this run's read-only {@link ToolBridgeApi} (bound to the live shared
 * store's spec + the backend) and hosts a remote sub-agent environment so Prime
 * can spawn a run inspector into it. A no-op passthrough when the tab has no
 * active session yet.
 */
function RunAgentHost({
  sessionId,
  runId,
  subgraphExecutionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
  children,
}: RunAgentBoundaryProps & { sessionId: string }) {
  const { navigation } = useSharedStores();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const authToken = authStorage.getToken();
  const backendUrlRef = useRef(backendUrl);
  const authTokenRef = useRef(authToken);

  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  const [bridge] = useState(() =>
    createRunViewToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((entry) => entry.displayName),
      getBackendUrl: () => backendUrlRef.current,
      getAuthToken: () => authTokenRef.current,
      queryClient,
    }),
  );

  return (
    <TangentRemoteEnvProvider
      sessionId={sessionId}
      bridge={bridge}
      context={{ mode: "runView", runId, subgraphExecutionId }}
      environmentId={environmentId}
      onEnvironmentReady={onEnvironmentReady}
      onEnvironmentClosed={onEnvironmentClosed}
      onBridgeReady={onBridgeReady}
      onBridgeClosed={onBridgeClosed}
    >
      {children}
    </TangentRemoteEnvProvider>
  );
}

function RunAgentBoundary({
  sessionId,
  children,
  ...rest
}: RunAgentBoundaryProps) {
  if (!sessionId) return <>{children}</>;
  return (
    <RunAgentHost sessionId={sessionId} {...rest}>
      {children}
    </RunAgentHost>
  );
}

/**
 * Embeds the run canvas (e.g. inside the Tangent workarea) with only the
 * providers `RunViewContent` requires. Unlike {@link RunViewV2}, it omits the
 * run menu bar and the `AiChatStoreProvider`, and keeps an isolated
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
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
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
        <RunAgentBoundary
          sessionId={sessionId}
          runId={runId}
          subgraphExecutionId={subgraphExecutionId}
          environmentId={environmentId}
          onEnvironmentReady={onEnvironmentReady}
          onEnvironmentClosed={onEnvironmentClosed}
          onBridgeReady={onBridgeReady}
          onBridgeClosed={onBridgeClosed}
        >
          <ComponentSpecProvider>
            <ReactFlowProvider>
              <ContextPanelProvider>
                <ExecutionDataProvider
                  pipelineRunId={runId}
                  subgraphExecutionId={subgraphExecutionId}
                >
                  <ComponentLibraryProvider>
                    <RunViewContent
                      runId={runId}
                      embedded
                      onSubgraphExecutionIdChange={setSubgraphExecutionId}
                    />
                  </ComponentLibraryProvider>
                </ExecutionDataProvider>
              </ContextPanelProvider>
            </ReactFlowProvider>
          </ComponentSpecProvider>
        </RunAgentBoundary>
      </SharedStoreProvider>
    </div>
  );
}
