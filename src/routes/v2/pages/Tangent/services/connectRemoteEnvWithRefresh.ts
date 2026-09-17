import { fetchRemoteEnvToken } from "@/routes/v2/pages/Tangent/services/fetchRemoteEnvToken";
import type { RemoteEnvHost } from "@/routes/v2/pages/Tangent/services/remoteEnvHost";
import { getErrorMessage } from "@/utils/string";

/** Refresh this long before a token expires, and never sooner than the floor. */
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const MIN_TOKEN_REFRESH_MS = 5_000;
const MAX_TOKEN_RETRY_MS = 30_000;

interface ConnectRemoteEnvOptions {
  host: RemoteEnvHost;
  baseUrl: string;
  sessionId: string;
  getAuthToken: () => string | undefined;
  initialEnvironmentId?: string;
  onConnected?: (environmentId: string) => void;
  onError: (message: string) => void;
}

/**
 * Connects a {@link RemoteEnvHost} with a self-renewing scoped token: mints a
 * token, connects, and schedules a refresh before it expires. The first
 * environment id is pinned across refreshes (the server routes an agent's
 * spawns to a specific environment, so a fresh id would silently remap it).
 * Returns a stop function that cancels the loop; the caller still owns
 * `host.disconnect()` and tearing down the worker.
 */
export function connectRemoteEnvWithRefresh(
  options: ConnectRemoteEnvOptions,
): () => void {
  const { host, baseUrl, sessionId, getAuthToken, onConnected, onError } =
    options;

  let cancelled = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let environmentId = options.initialEnvironmentId;
  let retryDelayMs = MIN_TOKEN_REFRESH_MS;

  function schedule(delay: number): void {
    refreshTimer = setTimeout(() => void connectWithFreshToken(), delay);
  }

  async function connectWithFreshToken(): Promise<void> {
    try {
      const token = await fetchRemoteEnvToken({
        baseUrl,
        sessionId,
        authToken: getAuthToken(),
        ...(environmentId ? { environmentId } : {}),
      });
      if (cancelled) return;
      environmentId = token.environmentId;
      await host.connect(token.token, token.environmentId);
      if (cancelled) return;
      retryDelayMs = MIN_TOKEN_REFRESH_MS;
      onConnected?.(token.environmentId);
      if (token.expiresAtMs) {
        const delay = Math.max(
          token.expiresAtMs - Date.now() - TOKEN_REFRESH_BUFFER_MS,
          MIN_TOKEN_REFRESH_MS,
        );
        schedule(delay);
      }
    } catch (error) {
      if (cancelled) return;
      onError(getErrorMessage(error));
      schedule(retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, MAX_TOKEN_RETRY_MS);
    }
  }

  void connectWithFreshToken();

  return () => {
    cancelled = true;
    if (refreshTimer) clearTimeout(refreshTimer);
  };
}
