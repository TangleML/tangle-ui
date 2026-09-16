/**
 * Connects the Tangent project workspace to the `/remote-env` gateway as the
 * session's default environment and registers the workarea tool catalog on it,
 * so an agent can open / list / read / close tabs in the Dynamic Workarea.
 *
 * It mints a scoped token, connects, and re-registers the tools on reconnect.
 * The tools read live workarea state through a ref, so a single catalog
 * instance always acts on the current tabs without rebuilding the connection.
 * It hosts no sub-agent runtime yet and renders `children` unchanged.
 */
import { nanoid } from "nanoid";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import useToastNotification from "@/hooks/useToastNotification";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import {
  createWorkareaRemoteTools,
  type WorkareaToolDeps,
} from "@/routes/v2/pages/Tangent/services/createWorkareaRemoteTools";
import { fetchRemoteEnvToken } from "@/routes/v2/pages/Tangent/services/fetchRemoteEnvToken";
import { createRemoteEnvHost } from "@/routes/v2/pages/Tangent/services/remoteEnvHost";
import { getErrorMessage } from "@/utils/string";

/** Refresh this long before a token expires, and never sooner than the floor. */
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const MIN_TOKEN_REFRESH_MS = 5_000;

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
  const {
    projectId,
    openWorkareaTarget,
    workareaTabs,
    activeWorkareaTabId,
    closeWorkareaTab,
  } = useTangentProject();
  const { baseUrl } = useTangentBaseUrl(projectId);

  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  const notifyRef = useRef(notify);

  // Pin one environment identity for this host so it survives token refreshes;
  // the server routes an agent's spawns to a specific `environmentId`.
  const [environmentId] = useState(() => `tangle-ui-${nanoid(8)}`);

  function buildDeps(): WorkareaToolDeps {
    return {
      openTarget: openWorkareaTarget,
      getTabs: () => workareaTabs,
      getActiveTabId: () => activeWorkareaTabId ?? undefined,
      closeTab: closeWorkareaTab,
    };
  }

  // The tools read deps via this ref so a single catalog instance always acts
  // on the current workarea state without rebuilding the socket connection.
  const depsRef = useRef<WorkareaToolDeps>(buildDeps());

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);
  useEffect(() => {
    depsRef.current = buildDeps();
  }, [openWorkareaTarget, workareaTabs, activeWorkareaTabId, closeWorkareaTab]);

  const [tools] = useState(() =>
    createWorkareaRemoteTools(() => depsRef.current),
  );

  useEffect(() => {
    if (!sessionId || !baseUrl) return;
    const activeSessionId = sessionId;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const onError = (message: string) => notifyRef.current(message, "error");
    const host = createRemoteEnvHost({
      url: baseUrl,
      tools,
      sessionId: activeSessionId,
      onError,
    });

    async function connectWithFreshToken(): Promise<void> {
      try {
        const { token, expiresAtMs } = await fetchRemoteEnvToken({
          baseUrl,
          sessionId: activeSessionId,
          authToken: authTokenRef.current,
          environmentId,
        });
        if (cancelled) return;
        host.connect(token, environmentId);
        if (expiresAtMs) {
          const delay = Math.max(
            expiresAtMs - Date.now() - TOKEN_REFRESH_BUFFER_MS,
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
    };
  }, [sessionId, tools, baseUrl, environmentId]);

  return <>{children}</>;
}
