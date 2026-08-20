/**
 * Connects the Tangent project workspace to the `/remote-env` gateway as the
 * session's default environment.
 *
 * This one environment does two jobs on a single socket:
 * - Hosts the workarea RPC **tools** (open / list / close tabs) so an agent can
 *   arrange the Dynamic Workarea.
 * - Hosts an editor sub-agent **runtime** (spawn / message / kill) bound to a
 *   routing bridge that drives whichever pipeline tab is active. This catches
 *   editor spawns that Prime does not bind to a specific tab's environment; per
 *   tab, {@link TangentEditorAgentProvider} still hosts its own environment for
 *   spawns explicitly bound to that tab.
 *
 * It mints a scoped token, boots the agent worker, connects, and re-registers
 * the tool catalog on reconnect. It renders `children` unchanged.
 */
import * as Comlink from "comlink";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useTangentSettings } from "@/hooks/useTangentSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { fetchRemoteEnvToken } from "@/routes/v2/pages/Editor/components/TangentChat/fetchRemoteEnvToken";
import { createRemoteEnvAgentWorker } from "@/routes/v2/pages/Editor/components/TangentChat/remoteEnvAgentWorker";
import { createRemoteEnvHost } from "@/routes/v2/pages/Editor/components/TangentChat/remoteEnvHost";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { getErrorMessage } from "@/utils/string";

import { createActiveTabRoutingBridge } from "./createActiveTabRoutingBridge";
import {
  createWorkareaRemoteTools,
  type WorkareaToolDeps,
} from "./createWorkareaRemoteTools";

/** Refresh this long before a token expires, and never sooner than the floor. */
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const MIN_TOKEN_REFRESH_MS = 5_000;

interface TangentProjectAgentProviderProps {
  sessionId: string;
  children: ReactNode;
}

export function TangentProjectAgentProvider({
  sessionId,
  children,
}: TangentProjectAgentProviderProps) {
  const notify = useToastNotification();
  const authStorage = useAuthLocalStorage();
  const { config: aiConfig } = useAiProviderSettings();
  const { baseUrl } = useTangentSettings();
  const {
    openWorkareaTarget,
    workareaTabs,
    closeWorkareaTab,
    getTabEnvironmentId,
    waitForTabEnvironment,
    getActiveTabBridge,
  } = useTangentProject();

  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  const notifyRef = useRef(notify);
  const aiConfigRef = useRef(aiConfig);
  const workerRef = useRef<Comlink.Remote<RemoteEnvWorkerApi> | null>(null);
  // The routing bridge reads the active tab's bridge via this ref, so a single
  // bridge instance always targets the current pipeline as tabs change.
  const getActiveTabBridgeRef = useRef(getActiveTabBridge);
  // The tools read deps via this ref so a single catalog instance always acts
  // on the current workarea state without rebuilding the socket connection.
  const depsRef = useRef<WorkareaToolDeps>({
    openTarget: openWorkareaTarget,
    getTabs: () => workareaTabs,
    closeTab: closeWorkareaTab,
    getEnvironmentId: getTabEnvironmentId,
    waitForEnvironment: waitForTabEnvironment,
  });

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);
  useEffect(() => {
    getActiveTabBridgeRef.current = getActiveTabBridge;
  }, [getActiveTabBridge]);
  useEffect(() => {
    depsRef.current = {
      openTarget: openWorkareaTarget,
      getTabs: () => workareaTabs,
      closeTab: closeWorkareaTab,
      getEnvironmentId: getTabEnvironmentId,
      waitForEnvironment: waitForTabEnvironment,
    };
  }, [
    openWorkareaTarget,
    workareaTabs,
    closeWorkareaTab,
    getTabEnvironmentId,
    waitForTabEnvironment,
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
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

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
      sessionId,
    });

    async function connectWithFreshToken(): Promise<void> {
      try {
        const { token, environmentId, expiresAt } = await fetchRemoteEnvToken({
          baseUrl,
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
  }, [sessionId, tools, routingBridge, baseUrl]);

  return <>{children}</>;
}
