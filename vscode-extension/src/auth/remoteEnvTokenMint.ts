import {
  createUnsignedJwt,
  type mintRemoteEnvToken,
  type MintRemoteEnvTokenParams,
  type ScopedEnvToken,
} from "@tangent/local-agent-host/remoteEnvToken.ts";
import type {
  RemoteEnvTokenRequest,
  RemoteEnvTokenResponse,
} from "@tangent/shared/contracts.ts";

import type { CookieProvider } from "./oktaSsoAuth.ts";

const REMOTE_ENV_TOKEN_PATH = "/api/embed/remote-env-token";

/**
 * Mints the Shell's `/remote-env` token with the OktaSSO cookie attached. The
 * stock {@link mintRemoteEnvToken} sends no cookie, so behind the SSO gate the
 * request lands on the HTML login page and JSON parsing fails. We send the
 * minted cookie, and only when the gate rejects us as unauthenticated (a 401 or
 * a login page in place of JSON) do we refresh the cookie once and retry. A
 * server error (5xx) or other non-JSON response is surfaced as a mint failure
 * rather than mistaken for an expired session, and the retry is skipped when the
 * refresh yields no new cookie.
 */
export function cookieAwareMint(
  cookieProvider: CookieProvider,
): typeof mintRemoteEnvToken {
  return async (params) => {
    const cookie = await cookieProvider();
    const first = await requestToken(params, cookie);
    if (isAuthenticatedJson(first) || !isAuthFailure(first)) {
      return parseToken(first);
    }

    const refreshed = await cookieProvider({ forceRefresh: true });
    if (!refreshed || refreshed === cookie) return parseToken(first);
    const second = await requestToken(params, refreshed);
    return parseToken(second);
  };
}

function requestToken(
  params: MintRemoteEnvTokenParams,
  cookie: string | undefined,
): Promise<Response> {
  const url = `${params.shellUrl.replace(/\/+$/, "")}${REMOTE_ENV_TOKEN_PATH}`;
  const body: RemoteEnvTokenRequest = {
    selector: params.selector,
    ...(params.environmentId ? { environmentId: params.environmentId } : {}),
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${createUnsignedJwt({ email: params.email })}`,
  };
  if (cookie) headers.Cookie = cookie;
  return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function isAuthenticatedJson(response: Response): boolean {
  return (
    response.ok &&
    (response.headers.get("content-type") ?? "").includes("application/json")
  );
}

/**
 * The SSO gate answers an unauthenticated mint with a 401 or, when it redirects
 * to its login page, a 200 whose body is HTML rather than JSON. Anything else
 * (a 5xx, a 404) is a real failure, not an expired session.
 */
function isAuthFailure(response: Response): boolean {
  if (response.status === 401) return true;
  return response.ok && !isAuthenticatedJson(response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResponseBody(value: unknown): value is RemoteEnvTokenResponse {
  return (
    isRecord(value) &&
    typeof value.token === "string" &&
    typeof value.environmentId === "string"
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function parseToken(response: Response): Promise<ScopedEnvToken> {
  if (!response.ok) {
    throw new Error(
      `Failed to mint remote-env token (${response.status} ${response.statusText}).`,
    );
  }
  const parsed = await readJson(response);
  if (!isResponseBody(parsed)) {
    throw new Error("Remote-env token response was malformed.");
  }
  const expiresAtMs = Date.parse(parsed.expiresAt);
  return {
    token: parsed.token,
    environmentId: parsed.environmentId,
    ...(Number.isNaN(expiresAtMs) ? {} : { expiresAtMs }),
  };
}
