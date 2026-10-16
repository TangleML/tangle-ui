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
 * A cross-origin absolute `url` is not trusted: it is reduced to its path on the
 * deployment's own origin, so a tampered or MITM'd manifest cannot point the
 * installer at another host.
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

export function manifestUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/extension/latest.json`;
}
