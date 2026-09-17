/**
 * Hosts a Tangent run-inspector sub-agent bound to this embedded run tab.
 *
 * Builds the same read-only `ToolBridgeApi` the in-run AI assistant uses — live
 * spec reads plus the shared run/debug fetches, with every spec mutation
 * short-circuited — and hands it to {@link TangentRemoteEnvProvider} with
 * `mode: "runView"`. A sub-agent Prime spawns into this tab's environment can
 * therefore inspect and debug exactly the run the user is viewing, without
 * being able to edit the spec.
 *
 * Must render inside the embed's `SharedStoreProvider` so `useSharedStores`
 * resolves this run tab's live navigation store.
 */
import { type ReactNode, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { TangentRemoteEnvProvider } from "@/routes/v2/pages/Tangent/components/TangentRemoteEnvProvider";
import { useLazyBridgeAuth } from "@/routes/v2/shared/components/AiChat/toolBridge/useLazyBridgeAuth";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { createRunViewToolBridge } from "./toolBridge/runViewToolBridge";

interface TangentRunAgentProviderProps {
  sessionId: string;
  runId: string;
  subgraphExecutionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
  children?: ReactNode;
}

export function TangentRunAgentProvider({
  sessionId,
  runId,
  subgraphExecutionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
  children,
}: TangentRunAgentProviderProps) {
  const { navigation } = useSharedStores();
  const { getBackendUrl, getAuthToken, queryClient } = useLazyBridgeAuth();

  const [bridge] = useState<ToolBridgeApi>(() =>
    createRunViewToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((entry) => entry.displayName),
      getActiveSubgraphTaskId: () => navigation.parentContext?.taskId,
      getBackendUrl,
      getAuthToken,
      queryClient,
    }),
  );

  return (
    <TangentRemoteEnvProvider
      sessionId={sessionId}
      bridge={bridge}
      context={{
        mode: "runView",
        runId,
        ...(subgraphExecutionId ? { subgraphExecutionId } : {}),
      }}
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
