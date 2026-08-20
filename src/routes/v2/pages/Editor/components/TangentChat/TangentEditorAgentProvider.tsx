/**
 * Wires the Tangent remote sub-agent host into the embed chat.
 *
 * Mounted inside the session workspace (so `sessionId` exists), it mints a
 * scoped token, boots the remote-env agent worker bound to the live Editor
 * spec, and connects to Tangent's `/remote-env` gateway. Prime can then
 * spawn an editor sub-agent that drives the open pipeline directly. It
 * renders `children` unchanged — the embed `<Chat>` tree is untouched.
 */
import { useQueryClient } from "@tanstack/react-query";
import * as Comlink from "comlink";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useTangentSettings } from "@/hooks/useTangentSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { createEditorToolBridge } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { getErrorMessage } from "@/utils/string";

import { fetchRemoteEnvToken } from "./fetchRemoteEnvToken";
import { createRemoteEnvAgentWorker } from "./remoteEnvAgentWorker";
import { createRemoteEnvHost } from "./remoteEnvHost";

/** Refresh this long before a token expires, and never sooner than the floor. */
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const MIN_TOKEN_REFRESH_MS = 5_000;

interface TangentEditorAgentProviderProps {
  sessionId: string;
  children: ReactNode;
  /**
   * A stable environment id to pin across token refreshes. Required when
   * several editor environments share one session (e.g. one per workarea tab)
   * so the server can route spawns to this specific editor. Omit for the
   * single-editor case, where the server-minted id is fine.
   */
  environmentId?: string;
  /** Called with the connected environment id after each (re)connect. */
  onEnvironmentReady?: (environmentId: string) => void;
  /** Called when the host disconnects (e.g. on unmount). */
  onEnvironmentClosed?: () => void;
  /**
   * Called with this editor's live `ToolBridgeApi` on mount, so a surrounding
   * host (e.g. the Tangent project) can drive this pipeline for spawns not
   * bound to this tab's own environment.
   */
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  /** Called when this editor unmounts and its bridge is no longer live. */
  onBridgeClosed?: () => void;
}

export function TangentEditorAgentProvider({
  sessionId,
  children,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: TangentEditorAgentProviderProps) {
  const notify = useToastNotification();
  const { navigation } = useSharedStores();
  const editorSession = useEditorSession();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();
  const { config: aiConfig } = useAiProviderSettings();
  const { baseUrl } = useTangentSettings();

  const backendUrlRef = useRef(backendUrl);
  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  const aiConfigRef = useRef(aiConfig);
  const notifyRef = useRef(notify);
  const workerRef = useRef<Comlink.Remote<RemoteEnvWorkerApi> | null>(null);
  const environmentIdRef = useRef(environmentId);
  const onEnvironmentReadyRef = useRef(onEnvironmentReady);
  const onEnvironmentClosedRef = useRef(onEnvironmentClosed);
  const onBridgeReadyRef = useRef(onBridgeReady);
  const onBridgeClosedRef = useRef(onBridgeClosed);

  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
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

  // The bridge closes over the navigation/undo stores plus backend/auth
  // read lazily via refs, so a single instance survives config changes —
  // matching how `AiChatContent` builds the Sidekick bridge.
  const [bridge] = useState(() =>
    createEditorToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((entry) => entry.displayName),
      getBackendUrl: () => backendUrlRef.current,
      getAuthToken: () => authTokenRef.current,
      queryClient,
      undo: editorSession.undo,
    }),
  );

  // Publish this editor's bridge to any surrounding host for its lifetime. The
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

    void remote.init(Comlink.proxy(bridge), { mode: "editor" });
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
