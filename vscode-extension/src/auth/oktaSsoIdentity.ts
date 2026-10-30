import { object, optional, string } from "zod/mini";

const claimsSchema = object({ email: optional(string()) });

function cookieValue(
  cookieHeader: string,
  cookieName: string,
): string | undefined {
  for (const pair of cookieHeader.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === cookieName) {
      return pair.slice(index + 1).trim();
    }
  }
  return undefined;
}

function decodeJwtClaims(jwt: string): unknown {
  const parts = jwt.split(".");
  if (parts.length !== 3) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Reads the `email` claim from the OktaSSO session JWT carried in a cookie. The
 * Shell resolves the prompting person from this same claim, so minting with it
 * makes a session's spawns route to the real user instead of the dev fallback.
 * The signature is not verified — the Shell owns verification; we only read the
 * identity the gate already minted.
 */
export function emailFromSessionCookie(
  cookieHeader: string,
  cookieName: string,
): string | undefined {
  const token = cookieValue(cookieHeader, cookieName);
  if (!token) return undefined;
  const parsed = claimsSchema.safeParse(decodeJwtClaims(token));
  if (!parsed.success) return undefined;
  return parsed.data.email || undefined;
}
