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
 * Callers build the bridge appropriate to their view — the Editor from its
 * live spec stores (see {@link TangentEditorAgentProvider}), the Run View from
 * its read-only run bridge — and hand it in. This provider renders `children`
 * unchanged.
 */
import * as Comlink from "comlink";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentContext } from "@/agent/types";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useTangentSettings } from "@/hooks/useTangentSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { getErrorMessage } from "@/utils/string";

import { fetchRemoteEnvToken } from "./fetchRemoteEnvToken";
import { createRemoteEnvAgentWorker } from "./remoteEnvAgentWorker";
import { createRemoteEnvHost } from "./remoteEnvHost";

/** Refresh this long before a token expires, and never sooner than the floor. */
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const MIN_TOKEN_REFRESH_MS = 5_000;

interface TangentRemoteEnvProviderProps {
  sessionId: string;
  /** This tab's live bridge; spawned sub-agents drive the tab through it. */
  bridge: ToolBridgeApi;
  /** Baked into the worker; selects the agent Prime spawns (editor vs run). */
  context: AgentContext;
  children: ReactNode;
  /**
   * A stable environment id to pin across token refreshes. Required when
   * several environments share one session (e.g. one per workarea tab) so the
   * server can route spawns to this specific tab. Omit for the single-editor
   * case, where the server-minted id is fine.
   */
  environmentId?: string;
  /** Called with the connected environment id after each (re)connect. */
  onEnvironmentReady?: (environmentId: string) => void;
  /** Called when the host disconnects (e.g. on unmount). */
  onEnvironmentClosed?: () => void;
  /**
   * Called with this tab's live bridge on mount, so a surrounding host (e.g.
   * the Tangent project) can drive this tab for spawns not bound to its own
   * environment.
   */
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  /** Called when this tab unmounts and its bridge is no longer live. */
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
  const authStorage = useAuthLocalStorage();
  const { config: aiConfig } = useAiProviderSettings();
  const { baseUrl } = useTangentSettings();

  const authToken = authStorage.getToken();
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
  useEffect(() => {
    contextRef.current = context;
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

  // Push AI config into the worker whenever the user changes it, so a turn
  // uses the latest provider settings without rebuilding the connection.
  useEffect(() => {
    aiConfigRef.current = aiConfig;
    void workerRef.current?.setAiConfig(aiConfig);
  }, [aiConfig]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

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

    async function connectWithFreshToken(): Promise<void> {
      try {
        const {
          token,
          environmentId: connectedEnvironmentId,
          expiresAt,
        } = await fetchRemoteEnvToken({
          baseUrl,
          sessionId,
          authToken: authTokenRef.current,
          environmentId: environmentIdRef.current,
        });
        if (cancelled) return;
        host.connect(token, connectedEnvironmentId);
        onEnvironmentReadyRef.current?.(connectedEnvironmentId);
        if (expiresAt) {
          const delay = Math.max(
            expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS,
            MIN_TOKEN_REFRESH_MS,
          );
          refreshTimer = setTimeout(() => void connectWithFreshToken(), delay);
        }
      } catch (error) {
        if (!cancelled) onError(getErrorMessage(error));
      }
    }

    void connectWithFreshToken();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      host.disconnect();
      worker.terminate();
      workerRef.current = null;
      onEnvironmentClosedRef.current?.();
    };
  }, [sessionId, bridge, baseUrl]);

  return <>{children}</>;
}
