/**
 * Mints (or falls back to) a scoped token for the Tangent `/remote-env`
 * socket handshake.
 *
 * The scoped-token endpoint is Tangent server work. Until it lands, a
 * `VITE_TANGENT_REMOTE_ENV_TOKEN` shared secret lets the host connect with a
 * client-generated `environmentId` (the legacy `HandshakeTokenCredential`
 * path). That fallback is only safe once the server routes spawns per session;
 * treat it as dev-only.
 */
import { nanoid } from "nanoid";

import { isRecord } from "@/utils/typeGuards";

export interface RemoteEnvToken {
  token: string;
  environmentId: string;
  expiresAtMs?: number;
}

/** Body of `POST /api/embed/remote-env-token` (mirrors `RemoteEnvTokenRequest`). */
interface RemoteEnvTokenRequestBody {
  sessionId: string;
  environmentId?: string;
}

const REMOTE_ENV_TOKEN_PATH = "/api/embed/remote-env-token";

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
  const value = import.meta.env.VITE_TANGENT_REMOTE_ENV_TOKEN;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * `environmentId` asks the server to keep this host's place across token
 * refreshes: the server reuses the id when it is free, but mints a fresh one
 * when another person's live host already holds it. So the pin is a request,
 * not a guarantee — the response's `environmentId` is authoritative. Omit to
 * always take a server-minted id.
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
  const fallbackToken = readFallbackToken();
  if (fallbackToken) {
    return {
      token: fallbackToken,
      environmentId: environmentId ?? `tangle-ui-${nanoid(8)}`,
    };
  }

  const url = `${baseUrl.replace(/\/$/, "")}${REMOTE_ENV_TOKEN_PATH}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const body: RemoteEnvTokenRequestBody = {
    sessionId,
    ...(environmentId ? { environmentId } : {}),
  };
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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
  // The server decides the id: it honors the pin when free, else mints a fresh
  // one. The socket lives under the token's claimed id, so the response wins.
  return parsed;
}
