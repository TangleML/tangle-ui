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
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { createEditorToolBridge } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TANGENT_BASE_URL } from "@/utils/constants";
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
}

export function TangentEditorAgentProvider({
  sessionId,
  children,
}: TangentEditorAgentProviderProps) {
  const notify = useToastNotification();
  const { navigation } = useSharedStores();
  const editorSession = useEditorSession();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();
  const { config: aiConfig } = useAiProviderSettings();

  const backendUrlRef = useRef(backendUrl);
  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  const aiConfigRef = useRef(aiConfig);
  const notifyRef = useRef(notify);
  const workerRef = useRef<Comlink.Remote<RemoteEnvWorkerApi> | null>(null);

  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

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
      url: TANGENT_BASE_URL,
      worker: remote,
      onError,
    });

    async function connectWithFreshToken(): Promise<void> {
      try {
        const { token, environmentId, expiresAt } = await fetchRemoteEnvToken({
          baseUrl: TANGENT_BASE_URL,
          sessionId,
          authToken: authTokenRef.current,
        });
        if (cancelled) return;
        host.connect(token, environmentId);
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
    };
  }, [sessionId, bridge]);

  return <>{children}</>;
}
