import { isRecord } from "@/utils/typeGuards";

interface SessionTagParams {
  baseUrl: string;
  sessionId: string;
  authToken?: string;
}

function sessionUrl(baseUrl: string, sessionId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(sessionId)}`;
}

function authHeaders(authToken?: string): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function parseSessionTags(value: unknown): string[] {
  if (!isRecord(value) || !isRecord(value.session)) {
    throw new Error("Tangent session response was malformed.");
  }
  const { tags } = value.session;
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === "string");
}

export async function getTangentSessionTags({
  baseUrl,
  sessionId,
  authToken,
}: SessionTagParams): Promise<string[]> {
  const response = await fetch(sessionUrl(baseUrl, sessionId), {
    headers: authHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to read Tangent session (${response.status} ${response.statusText}).`,
    );
  }
  return parseSessionTags(await response.json());
}

export async function replaceTangentSessionTags({
  baseUrl,
  sessionId,
  authToken,
  tags,
}: SessionTagParams & { tags: string[] }): Promise<void> {
  const response = await fetch(sessionUrl(baseUrl, sessionId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to update Tangent session tags (${response.status} ${response.statusText}).`,
    );
  }
}

/**
 * Ensures `tag` is among the session's tags, adding it to the existing set when
 * missing. Returns whether a write was needed, so a caller can refresh only when
 * routing actually changed. The server replaces the whole array, so the union is
 * sent to preserve any tags this client does not know about.
 */
export async function ensureSessionTag({
  baseUrl,
  sessionId,
  authToken,
  tag,
}: SessionTagParams & { tag: string }): Promise<boolean> {
  const tags = await getTangentSessionTags({ baseUrl, sessionId, authToken });
  if (tags.includes(tag)) return false;
  await replaceTangentSessionTags({
    baseUrl,
    sessionId,
    authToken,
    tags: [...tags, tag],
  });
  return true;
}
