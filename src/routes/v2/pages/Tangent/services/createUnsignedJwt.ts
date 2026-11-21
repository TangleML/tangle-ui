function base64UrlEncode(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Fallback for backends without identity assertions: a JWT with `alg: "none"`
 * and an empty signature segment. A Tangent instance decodes the claims
 * without verifying the signature, so a client can still present its identity
 * when the backend cannot issue one.
 */
export function createUnsignedJwt(claims: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  return `${header}.${payload}.`;
}
