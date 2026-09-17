/**
 * Connects the Tangent project workspace to the `/remote-env` gateway as the
 * session's default environment.
 *
 * This one environment does two jobs on a single socket:
 * - Hosts the workarea RPC **tools** (open / list / read / close tabs, plus
 *   run inspect) so an agent can arrange and read the Dynamic Workarea.
 * - Hosts an editor sub-agent **runtime** (spawn / message / kill) bound to a
 *   routing bridge that drives whichever pipeline tab is active. This catches
 *   editor spawns that Prime does not bind to a specific tab's environment; per
 *   tab, the embedded views still host their own environment for spawns
 *   explicitly bound to that tab.
 *
 * It mints a scoped token, boots the agent worker, connects, and re-registers
 * the tool catalog on reconnect. It renders `children` unchanged.
 */
import { useQueryClient } from "@tanstack/react-query";
import * as Comlink from "comlink";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { connectRemoteEnvWithRefresh } from "@/routes/v2/pages/Tangent/services/connectRemoteEnvWithRefresh";
import { createActiveTabRoutingBridge } from "@/routes/v2/pages/Tangent/services/createActiveTabRoutingBridge";
import {
  createWorkareaRemoteTools,
  type RunInspectDeps,
  type WorkareaToolDeps,
} from "@/routes/v2/pages/Tangent/services/createWorkareaRemoteTools";
import { createRemoteEnvAgentWorker } from "@/routes/v2/pages/Tangent/services/remoteEnvAgentWorker";
import { createRemoteEnvHost } from "@/routes/v2/pages/Tangent/services/remoteEnvHost";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";

interface TangentProjectAgentProviderProps {
  sessionId: string | undefined;
  children: ReactNode;
}

export function TangentProjectAgentProvider({
  sessionId,
  children,
}: TangentProjectAgentProviderProps) {
  const notify = useToastNotification();
  const authStorage = useAuthLocalStorage();
  const { config: aiConfig } = useAiProviderSettings();
  const { backendUrl } = useBackend();
  const queryClient = useQueryClient();
  const {
    projectId,
    openWorkareaTarget,
    getWorkareaTabs,
    getActiveWorkareaTabId,
    closeWorkareaTab,
    getTabEnvironmentId,
    waitForTabEnvironment,
    getActiveTabBridge,
  } = useTangentProject();
  const { baseUrl } = useTangentBaseUrl(projectId);

  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  const backendUrlRef = useRef(backendUrl);
  const notifyRef = useRef(notify);
  const aiConfigRef = useRef(aiConfig);
  const workerRef = useRef<Comlink.Remote<RemoteEnvWorkerApi> | null>(null);
  // The routing bridge reads the active tab's bridge via this ref, so a single
  // bridge instance always targets the current pipeline as tabs change.
  const getActiveTabBridgeRef = useRef(getActiveTabBridge);

  // A project-level backend bridge for the run inspect tools: read-only run and
  // execution fetches that don't need any one tab's canvas spec, so Prime can
  // inspect runs without spawning a sub-agent. Backend/auth are read lazily via
  // refs so a single instance survives config changes.
  const [runInspect] = useState<RunInspectDeps>(() => {
    const deps: BridgeDeps = {
      getSpec: () => null,
      getActiveSubgraphPath: () => [],
      getActiveSubgraphTaskId: () => undefined,
      getBackendUrl: () => backendUrlRef.current,
      getAuthToken: () => authTokenRef.current,
      queryClient,
    };
    const run = createRunBridgeHandlers(deps);
    const debug = createDebugBridgeHandlers(deps);
    return {
      getRunDetails: run.getRunDetails,
      debugPipelineRun: run.debugPipelineRun,
      getExecutionDetails: debug.getExecutionDetails,
      getExecutionState: debug.getExecutionState,
      getContainerState: debug.getContainerState,
      getContainerLog: debug.getContainerLog,
    };
  });

  function buildDeps(): WorkareaToolDeps {
    return {
      openTarget: openWorkareaTarget,
      getTabs: getWorkareaTabs,
      getActiveTabId: getActiveWorkareaTabId,
      closeTab: closeWorkareaTab,
      getEnvironmentId: getTabEnvironmentId,
      waitForEnvironment: waitForTabEnvironment,
      runInspect,
    };
  }

  // The tools read deps via this ref so a single catalog instance always acts
  // on the current workarea state without rebuilding the socket connection.
  const depsRef = useRef<WorkareaToolDeps>(buildDeps());

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);
  useEffect(() => {
    getActiveTabBridgeRef.current = getActiveTabBridge;
  }, [getActiveTabBridge]);
  useEffect(() => {
    depsRef.current = buildDeps();
  }, [
    openWorkareaTarget,
    getWorkareaTabs,
    getActiveWorkareaTabId,
    closeWorkareaTab,
    getTabEnvironmentId,
    waitForTabEnvironment,
    runInspect,
  ]);

  // Push AI config into the worker whenever the user changes it, so a turn
  // uses the latest provider settings without rebuilding the connection.
  useEffect(() => {
    aiConfigRef.current = aiConfig;
    void workerRef.current?.setAiConfig(aiConfig);
  }, [aiConfig]);

  const [tools] = useState(() =>
    createWorkareaRemoteTools(() => depsRef.current),
  );
  const [routingBridge] = useState(() =>
    createActiveTabRoutingBridge(() => getActiveTabBridgeRef.current()),
  );

  useEffect(() => {
    if (!sessionId || !baseUrl) return;
    const activeSessionId = sessionId;

    const onError = (message: string) => notifyRef.current(message, "error");

    const worker = createRemoteEnvAgentWorker();
    const remote = Comlink.wrap<RemoteEnvWorkerApi>(worker);
    workerRef.current = remote;

    void remote.init(Comlink.proxy(routingBridge), { mode: "editor" });
    void remote.setAiConfig(aiConfigRef.current);

    const host = createRemoteEnvHost({
      url: baseUrl,
      worker: remote,
      onError,
      tools,
      sessionId: activeSessionId,
    });

    const stop = connectRemoteEnvWithRefresh({
      host,
      baseUrl,
      sessionId: activeSessionId,
      getAuthToken: () => authTokenRef.current,
      onError,
    });

    return () => {
      stop();
      host.disconnect();
      worker.terminate();
      workerRef.current = null;
    };
  }, [sessionId, tools, routingBridge, baseUrl]);

  return <>{children}</>;
}
