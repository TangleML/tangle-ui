/**
 * Mints (or falls back to) a scoped token for the Tangent `/remote-env`
 * socket handshake.
 *
 * The scoped-token endpoint is Tangent server work (plan section A). Until
 * it lands, a `VITE_TANGENT_REMOTE_ENV_TOKEN` shared secret lets the host
 * connect with a client-generated `environmentId` (the legacy
 * `HandshakeTokenCredential` path). That fallback is only safe once the
 * server routes spawns per session; treat it as dev-only.
 */
import { nanoid } from "nanoid";

import { isRecord } from "@/utils/typeGuards";

export interface RemoteEnvToken {
  token: string;
  environmentId: string;
  /** Epoch milliseconds when the token expires, when the server reports it. */
  expiresAt?: number;
}

const REMOTE_ENV_TOKEN_PATH = "/api/embed/remote-env-token";

function parseExpiresAt(value: unknown): number | undefined {
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
  const expiresAt = parseExpiresAt(value.expiresAt);
  return { token, environmentId, ...(expiresAt ? { expiresAt } : {}) };
}

function readFallbackToken(): string | undefined {
  const value = import.meta.env.VITE_TANGENT_REMOTE_ENV_TOKEN;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export interface FetchRemoteEnvTokenParams {
  /** Base Tangent URL (same origin as the embed API). */
  baseUrl: string;
  /** The embed session the token is scoped to. */
  sessionId: string;
  /** Bearer token for the embed API, when the host has one. */
  authToken?: string;
}

export async function fetchRemoteEnvToken({
  baseUrl,
  sessionId,
  authToken,
}: FetchRemoteEnvTokenParams): Promise<RemoteEnvToken> {
  const fallbackToken = readFallbackToken();
  if (fallbackToken) {
    return { token: fallbackToken, environmentId: `tangle-ui-${nanoid(8)}` };
  }

  const url = `${baseUrl.replace(/\/$/, "")}${REMOTE_ENV_TOKEN_PATH}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to mint remote-env token (${response.status} ${response.statusText}).`,
    );
  }

  const parsed = parseTokenResponse(await response.json());
  if (!parsed) {
    throw new Error("Remote-env token response was malformed.");
  }
  return parsed;
}
