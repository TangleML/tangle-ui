import { normalizeBackendUrl } from "@/utils/backendIdentity";
import { MINUTES } from "@/utils/constants";
import { isRecord } from "@/utils/typeGuards";

import { createUnsignedJwt } from "./createUnsignedJwt";

const IDENTITY_ASSERTION_PATH = "/api/tangent/identity_assertion";
const TANGENT_INSTANCES_PATH = "/api/tangent/instances/";

const REFRESH_LEAD_MS = 5 * MINUTES;

export interface IdentityAssertion {
  token: string;
  expiresAtMs: number;
}

export interface IdentityToken {
  token: string;
  refreshAtMs?: number;
}

export interface IdentityTokenParams {
  backendUrl: string;
  instanceId: string | undefined;
  email: string;
}

export class IdentityAssertionUnsupportedError extends Error {
  constructor(backendUrl: string) {
    super(`The backend at ${backendUrl} does not issue identity assertions.`);
    this.name = "IdentityAssertionUnsupportedError";
  }
}

export class IdentityAssertionRequestError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`Failed to fetch an identity assertion (${status} ${statusText}).`);
    this.name = "IdentityAssertionRequestError";
    this.status = status;
  }
}

interface CacheEntry {
  pending: Promise<IdentityAssertion>;
  expiresAtMs?: number;
}

const assertions = new Map<string, CacheEntry>();
const backendsWithoutAssertions = new Set<string>();

/**
 * The id of the backend-proxied Tangent instance `baseUrl` points at, if any.
 * Only a url on the backend's own origin and below its path prefix counts; a
 * proxy-shaped path on any other host is some other Tangent.
 */
export function instanceIdFromTangentBaseUrl(
  baseUrl: string,
  backendUrl: string,
): string | undefined {
  try {
    const tangent = new URL(baseUrl, window.location.href);
    const backend = new URL(normalizeBackendUrl(backendUrl));
    if (tangent.origin !== backend.origin) return undefined;

    const instancesPath = `${backend.pathname.replace(/\/+$/, "")}${TANGENT_INSTANCES_PATH}`;
    if (!tangent.pathname.startsWith(instancesPath)) return undefined;

    const [id] = tangent.pathname.slice(instancesPath.length).split("/");
    return id ? decodeURIComponent(id) : undefined;
  } catch {
    return undefined;
  }
}

function parseAssertion(value: unknown): IdentityAssertion | null {
  if (!isRecord(value)) return null;
  const { token, expires_at: expiresAt } = value;
  if (typeof token !== "string" || token.length === 0) return null;
  if (typeof expiresAt !== "string") return null;
  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) return null;
  return { token, expiresAtMs };
}

async function requestIdentityAssertion(
  backendUrl: string,
  instanceId: string | undefined,
): Promise<IdentityAssertion> {
  const response = await fetch(`${backendUrl}${IDENTITY_ASSERTION_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(instanceId ? { instance_id: instanceId } : {}),
  });
  if (response.status === 404) {
    throw new IdentityAssertionUnsupportedError(backendUrl);
  }
  if (!response.ok) {
    throw new IdentityAssertionRequestError(
      response.status,
      response.statusText,
    );
  }
  const parsed = parseAssertion(await response.json());
  if (!parsed) {
    throw new Error("Identity assertion response was malformed.");
  }
  return parsed;
}

function isFresh(expiresAtMs: number): boolean {
  return expiresAtMs - Date.now() > REFRESH_LEAD_MS;
}

export function fetchIdentityAssertion(
  backendUrl: string,
  instanceId?: string,
): Promise<IdentityAssertion> {
  const key = `${backendUrl}\n${instanceId ?? ""}`;
  const cached = assertions.get(key);
  if (
    cached &&
    (cached.expiresAtMs === undefined || isFresh(cached.expiresAtMs))
  ) {
    return cached.pending;
  }

  const entry: CacheEntry = {
    pending: requestIdentityAssertion(backendUrl, instanceId),
  };
  assertions.set(key, entry);
  entry.pending.then(
    (assertion) => {
      entry.expiresAtMs = assertion.expiresAtMs;
    },
    () => {
      if (assertions.get(key) === entry) assertions.delete(key);
    },
  );
  return entry.pending;
}

function unsignedIdentityToken(email: string): IdentityToken {
  return { token: createUnsignedJwt({ email }) };
}

function shouldPresentUnsignedIdentity(
  backendUrl: string,
  instanceId: string | undefined,
): boolean {
  if (backendsWithoutAssertions.has(backendUrl)) return true;
  return instanceId === undefined && !import.meta.env.DEV;
}

/**
 * A signed assertion is scoped to the Tangent instance the backend proxies.
 * An embed url that names no backend instance is some other Tangent, which
 * must not receive an assertion minted for a backend instance; it gets the
 * unsigned identity instead. In development the backend accepts an unscoped
 * request, so a local Tangent is still handed a signed token.
 */
export async function identityToken({
  backendUrl,
  instanceId,
  email,
}: IdentityTokenParams): Promise<IdentityToken> {
  if (shouldPresentUnsignedIdentity(backendUrl, instanceId)) {
    return unsignedIdentityToken(email);
  }
  try {
    const { token, expiresAtMs } = await fetchIdentityAssertion(
      backendUrl,
      instanceId,
    );
    return { token, refreshAtMs: expiresAtMs - REFRESH_LEAD_MS };
  } catch (error) {
    if (!(error instanceof IdentityAssertionUnsupportedError)) throw error;
    backendsWithoutAssertions.add(backendUrl);
    console.warn(
      `${error.message} Presenting an unsigned identity to the Tangent instance instead.`,
    );
    return unsignedIdentityToken(email);
  }
}
