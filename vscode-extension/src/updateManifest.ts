export interface ExtensionManifest {
  version: string;
  filename: string;
  url: string;
}

function hasStringProp<K extends string>(
  value: object,
  key: K,
): value is { [P in K]: string } {
  return (
    key in value && typeof (value as { [P in K]: unknown })[key] === "string"
  );
}

export function isExtensionManifest(
  value: unknown,
): value is ExtensionManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    hasStringProp(value, "version") &&
    hasStringProp(value, "filename") &&
    hasStringProp(value, "url")
  );
}

/** True when `candidate` is a strictly higher dotted version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parts = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * Resolves the manifest's `url` against the deployment base to an absolute URL.
 * A cross-origin absolute `url` is reduced to its path on the deployment's own
 * origin, so a tampered manifest cannot redirect the installer to another host.
 * This pins the origin only; it does not make a plain-http origin safe, which
 * {@link isTrustedUpdateUrl} guards separately.
 */
export function resolveVsixUrl(baseUrl: string, manifestUrl: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  if (/^https?:\/\//.test(manifestUrl)) {
    const absolute = new URL(manifestUrl);
    if (absolute.origin === new URL(baseUrl).origin) return manifestUrl;
    return `${origin}${absolute.pathname}${absolute.search}`;
  }
  return manifestUrl.startsWith("/")
    ? `${origin}${manifestUrl}`
    : `${origin}/${manifestUrl}`;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * A plain-http update origin lets an on-path attacker serve a malicious `.vsix`
 * from the deployment's own host, so auto-install is allowed only over https or
 * a loopback host (local development).
 */
export function isTrustedUpdateUrl(url: string): boolean {
  const parsed = new URL(url);
  return parsed.protocol === "https:" || LOOPBACK_HOSTS.has(parsed.hostname);
}

export function manifestUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/extension/latest.json`;
}
