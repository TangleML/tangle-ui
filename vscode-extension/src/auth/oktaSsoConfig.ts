const DEFAULT_SCOPES = "profile email openid";
const DEFAULT_REDIRECT_URI = "http://localhost:3001/auth";
const DEFAULT_CALLBACK_PORT = 3001;
const DEFAULT_REFRESH_AFTER_MS = 3_300_000;

export interface OktaSsoConfig {
  oauthEndpointBase: string;
  tokenExchangeUrl: string;
  clientId: string;
  cookieName: string;
  scopes: string;
  redirectUri: string;
  callbackPort: number;
  refreshAfterMs: number;
}

function trimmed(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function numberValue(raw: string | undefined, fallback: number): number {
  const parsed = Number(trimmed(raw));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads each key as a static `process.env.VITE_OKTASSO_*` so esbuild's `define`
 * inlines the build-time value — a dynamic `process.env[key]` would be left
 * untouched and read as `undefined` in the packaged extension.
 */
export function getOktaSsoConfig(): OktaSsoConfig {
  return {
    oauthEndpointBase: trimmed(process.env.VITE_OKTASSO_OAUTH_ENDPOINT_BASE),
    tokenExchangeUrl: trimmed(process.env.VITE_OKTASSO_TOKEN_EXCHANGE_URL),
    clientId: trimmed(process.env.VITE_OKTASSO_CLIENT_ID),
    cookieName: trimmed(process.env.VITE_OKTASSO_TOKEN_COOKIE_NAME),
    scopes: trimmed(process.env.VITE_OKTASSO_SCOPES) || DEFAULT_SCOPES,
    redirectUri:
      trimmed(process.env.VITE_OKTASSO_REDIRECT_URI) || DEFAULT_REDIRECT_URI,
    callbackPort: numberValue(
      process.env.VITE_OKTASSO_CALLBACK_PORT,
      DEFAULT_CALLBACK_PORT,
    ),
    refreshAfterMs: numberValue(
      process.env.VITE_OKTASSO_REFRESH_AFTER_MS,
      DEFAULT_REFRESH_AFTER_MS,
    ),
  };
}

/**
 * The gate is on only when it is configured: an explicit `VITE_OKTASSO_ENABLED=false`
 * is a kill switch, and the four proprietary values must all be present. OSS
 * checkouts leave them blank, so the extension behaves exactly as before.
 */
export function isOktaSsoEnabled(
  config: OktaSsoConfig = getOktaSsoConfig(),
): boolean {
  if (trimmed(process.env.VITE_OKTASSO_ENABLED) === "false") return false;
  return Boolean(
    config.oauthEndpointBase &&
    config.tokenExchangeUrl &&
    config.clientId &&
    config.cookieName,
  );
}

/**
 * A loopback audience is a local dev backend the Okta IdP can mint no session
 * for, so the gate skips it and the extension connects as the dev identity.
 */
export function isLoopbackAudience(audienceUrl: string): boolean {
  try {
    const host = new URL(audienceUrl).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    return false;
  }
}
