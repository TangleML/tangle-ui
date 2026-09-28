/**
 * Hosts a Tangent remote sub-agent environment for one workarea tab.
 *
 * This owns the transport concerns shared by every embedded tab that Prime can
 * spawn a sub-agent into: it mints a scoped token, boots the remote-env agent
 * worker bound to the tab's live `ToolBridgeApi`, connects to Tangent's
 * `/remote-env` gateway, and refreshes the token before it expires. The
 * `AgentContext` it is given decides which agent Prime gets on spawn (an
 * editor for `mode: "editor"`, a read-only run inspector for `mode: "runView"`).
 *
 * Callers build the bridge appropriate to their view — the editor from its live
 * spec stores, the run view from its read-only run bridge — and hand it in.
 * This provider renders `children` unchanged.
 */
import * as Comlink from "comlink";
import { type ReactNode, useEffect, useRef } from "react";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentContext } from "@/agent/types";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { connectRemoteEnvWithRefresh } from "@/routes/v2/pages/Tangent/services/connectRemoteEnvWithRefresh";
import { createRemoteEnvAgentWorker } from "@/routes/v2/pages/Tangent/services/remoteEnvAgentWorker";
import { createRemoteEnvHost } from "@/routes/v2/pages/Tangent/services/remoteEnvHost";

interface TangentRemoteEnvProviderProps {
  sessionId: string;
  bridge: ToolBridgeApi;
  context: AgentContext;
  children: ReactNode;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

export function TangentRemoteEnvProvider({
  sessionId,
  bridge,
  context,
  children,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: TangentRemoteEnvProviderProps) {
  const notify = useToastNotification();
  const { config: aiConfig } = useAiProviderSettings();
  const { projectId } = useTangentProject();
  const { baseUrl } = useTangentBaseUrl(projectId);

  const authToken = useRemoteEnvAuthToken();
  const authTokenRef = useRef(authToken);
  const aiConfigRef = useRef(aiConfig);
  const contextRef = useRef(context);
  const notifyRef = useRef(notify);
  const workerRef = useRef<Comlink.Remote<RemoteEnvWorkerApi> | null>(null);
  const environmentIdRef = useRef(environmentId);
  const onEnvironmentReadyRef = useRef(onEnvironmentReady);
  const onEnvironmentClosedRef = useRef(onEnvironmentClosed);
  const onBridgeReadyRef = useRef(onBridgeReady);
  const onBridgeClosedRef = useRef(onBridgeClosed);

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  // Push context into the worker whenever it changes (e.g. the run view enters
  // a subgraph) so later turns reflect the current run/subgraph in their prompt
  // without rebuilding the connection.
  useEffect(() => {
    contextRef.current = context;
    void workerRef.current?.setContext(context);
  }, [context]);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);
  useEffect(() => {
    environmentIdRef.current = environmentId;
  }, [environmentId]);
  useEffect(() => {
    onEnvironmentReadyRef.current = onEnvironmentReady;
  }, [onEnvironmentReady]);
  useEffect(() => {
    onEnvironmentClosedRef.current = onEnvironmentClosed;
  }, [onEnvironmentClosed]);
  useEffect(() => {
    onBridgeReadyRef.current = onBridgeReady;
  }, [onBridgeReady]);
  useEffect(() => {
    onBridgeClosedRef.current = onBridgeClosed;
  }, [onBridgeClosed]);

  // Publish this tab's bridge to any surrounding host for its lifetime. The
  // bridge instance is stable, so this registers once on mount and clears on
  // unmount regardless of how the callbacks change.
  useEffect(() => {
    onBridgeReadyRef.current?.(bridge);
    return () => onBridgeClosedRef.current?.();
  }, [bridge]);

  // Push AI config into the worker whenever the user changes it, so a turn uses
  // the latest provider settings without rebuilding the connection.
  useEffect(() => {
    aiConfigRef.current = aiConfig;
    void workerRef.current?.setAiConfig(aiConfig);
  }, [aiConfig]);

  useEffect(() => {
    if (!baseUrl) return;

    const onError = (message: string) => notifyRef.current(message, "error");

    const worker = createRemoteEnvAgentWorker();
    const remote = Comlink.wrap<RemoteEnvWorkerApi>(worker);
    workerRef.current = remote;

    void remote.init(Comlink.proxy(bridge), contextRef.current);
    void remote.setAiConfig(aiConfigRef.current);

    const host = createRemoteEnvHost({
      url: baseUrl,
      worker: remote,
      onError,
    });

    const stop = connectRemoteEnvWithRefresh({
      host,
      baseUrl,
      sessionId,
      getAuthToken: () => authTokenRef.current,
      initialEnvironmentId: environmentIdRef.current,
      onConnected: (connectedEnvironmentId) =>
        onEnvironmentReadyRef.current?.(connectedEnvironmentId),
      onError,
    });

    return () => {
      stop();
      host.disconnect();
      worker.terminate();
      workerRef.current = null;
      onEnvironmentClosedRef.current?.();
    };
  }, [sessionId, bridge, baseUrl]);

  return <>{children}</>;
}
