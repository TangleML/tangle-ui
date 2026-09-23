/**
 * Mints a scoped token for the Tangent `/remote-env` socket handshake.
 *
 * A `VITE_TANGENT_REMOTE_ENV_TOKEN` shared secret remains as a fallback for
 * developing against a Tangent server that predates the scoped-token endpoint.
 * It connects with a client-generated `environmentId` (the legacy
 * `HandshakeTokenCredential` path), which is only safe once the server routes
 * spawns per session — so it is reached only when the endpoint reports itself
 * absent, and never in a production build.
 */
import { nanoid } from "nanoid";

import { isRecord } from "@/utils/typeGuards";

export interface RemoteEnvToken {
  token: string;
  environmentId: string;
  expiresAtMs?: number;
}

const REMOTE_ENV_TOKEN_PATH = "/api/embed/remote-env-token";

// How a Tangent server that predates the mint endpoint reports it is not there.
const ENDPOINT_ABSENT_STATUSES = new Set([404, 501]);

function parseExpiresAtMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Heuristic: values below ~1e12 are epoch seconds, not milliseconds.
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseTokenResponse(value: unknown): RemoteEnvToken | null {
  if (!isRecord(value)) return null;
  const { token, environmentId } = value;
  if (typeof token !== "string" || token.length === 0) return null;
  if (typeof environmentId !== "string" || environmentId.length === 0) {
    return null;
  }
  const expiresAtMs = parseExpiresAtMs(value.expiresAt);
  return { token, environmentId, ...(expiresAtMs ? { expiresAtMs } : {}) };
}

function readFallbackToken(): string | undefined {
  // Vite inlines every `VITE_*` value into the bundle, so a shared secret read
  // here would ship to every browser. The guard precedes the read so the
  // literal is dropped with the dead branch rather than surviving in it.
  if (!import.meta.env.DEV) return undefined;
  const value = import.meta.env.VITE_TANGENT_REMOTE_ENV_TOKEN;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function fallbackCredential(
  environmentId: string | undefined,
): RemoteEnvToken | undefined {
  const token = readFallbackToken();
  if (!token) return undefined;
  return { token, environmentId: environmentId ?? `tangle-ui-${nanoid(8)}` };
}

/**
 * `environmentId` pins a stable identity across token refreshes: the server
 * routes an agent's spawns to a specific `environmentId` within a session, so a
 * caller hosting one environment must keep it rather than take a fresh
 * server-minted id on every refresh. Omit to accept the server's id.
 */
export interface FetchRemoteEnvTokenParams {
  baseUrl: string;
  sessionId: string;
  authToken?: string;
  environmentId?: string;
}

export async function fetchRemoteEnvToken({
  baseUrl,
  sessionId,
  authToken,
  environmentId,
}: FetchRemoteEnvTokenParams): Promise<RemoteEnvToken> {
  const url = `${baseUrl.replace(/\/$/, "")}${REMOTE_ENV_TOKEN_PATH}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId,
      ...(environmentId ? { environmentId } : {}),
    }),
  });
  if (!response.ok) {
    if (ENDPOINT_ABSENT_STATUSES.has(response.status)) {
      const fallback = fallbackCredential(environmentId);
      if (fallback) return fallback;
    }
    throw new Error(
      `Failed to mint remote-env token (${response.status} ${response.statusText}).`,
    );
  }

  const parsed = parseTokenResponse(await response.json());
  if (!parsed) {
    throw new Error("Remote-env token response was malformed.");
  }
  // Keep the caller's stable id authoritative so it survives token refreshes.
  return environmentId ? { ...parsed, environmentId } : parsed;
}
