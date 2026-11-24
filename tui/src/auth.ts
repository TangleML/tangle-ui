import {
  getOktassoCookie,
  peekOktassoCookie,
} from "@tangent/local-agent-host/oktasso.ts";
import { createOktassoFetch } from "@tangent/local-agent-host/oktassoFetch.ts";

const fetchers = new Map<string, typeof fetch>();
const cookies = new Map<string, string>();

export function originOf(url: string): string {
  return new URL(url).origin;
}

/**
 * Whether the deployment's Okta SSO config is present. When it is not (local
 * dev), the client never attempts a browser login and requests go out bare.
 */
export function isOktaEnabled(): boolean {
  return Boolean(
    process.env.OKTASSO_OAUTH_ENDPOINT_BASE &&
    process.env.OKTASSO_TOKEN_EXCHANGE_URL &&
    process.env.OKTASSO_CLIENT_ID &&
    process.env.AUTH_JWT_TOKEN_COOKIE_NAME,
  );
}

/**
 * A `fetch` for one origin that authenticates itself against an Okta-protected
 * Shell or Tangle API: it rides the cached SSO cookie and, on a proxy block,
 * runs the browser login once and retries. Memoized so one origin shares a
 * single in-flight login across callers.
 */
export function authFetch(url: string): typeof fetch {
  const origin = originOf(url);
  const existing = fetchers.get(origin);
  if (existing) return existing;
  const wrapped = createOktassoFetch(origin);
  fetchers.set(origin, wrapped);
  return wrapped;
}

/** A warm SSO cookie for the origin, if one is cached; never opens a browser. */
export async function peekCookie(url: string): Promise<string | undefined> {
  const origin = originOf(url);
  const cached = cookies.get(origin);
  if (cached) return cached;
  const peeked = await peekOktassoCookie(origin).catch(() => null);
  if (!peeked) return undefined;
  cookies.set(origin, peeked);
  return peeked;
}

/**
 * The SSO cookie for the origin, running the browser login once when nothing is
 * cached. Returns `undefined` when the gate is off, so callers pass no cookie.
 */
export async function ensureCookie(url: string): Promise<string | undefined> {
  const peeked = await peekCookie(url);
  if (peeked) return peeked;
  if (!isOktaEnabled()) return undefined;
  const origin = originOf(url);
  const cookie = await getOktassoCookie(origin);
  cookies.set(origin, cookie);
  return cookie;
}
