function base64UrlEncode(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds a JWT with `alg: "none"` and an empty signature segment. The Tangent
 * embed mint endpoint decodes the claims without verifying the signature, so a
 * client can present its identity without a server-issued credential.
 */
export function createUnsignedJwt(claims: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  return `${header}.${payload}.`;
}
