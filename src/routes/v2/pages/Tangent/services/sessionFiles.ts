import { isRecord } from "@/utils/typeGuards";

export interface SessionFileRecord {
  sessionId: string;
  path: string;
  title: string;
  addedAt: Date;
  pinned: boolean;
}

interface SessionRequest {
  baseUrl: string;
  sessionId: string;
  authToken?: string;
}

const AGENT_OUTPUT_DIR = "artifacts/";

function sessionUrl(baseUrl: string, sessionId: string, rest: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(sessionId)}/${rest}`;
}

function authHeaders(authToken: string | undefined): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/**
 * A file an agent pinned is always listed; any other file counts only when it
 * sits in `artifacts/`, where agents write what they make. Uploads, memory and
 * host entries are someone else's.
 */
function parseSessionFile(
  sessionId: string,
  value: unknown,
): SessionFileRecord | null {
  if (!isRecord(value)) return null;
  const { kind, uri, name, createdAt } = value;
  if (typeof uri !== "string" || uri === "") return null;
  const pinned = kind === "artifact";
  if (!pinned && !(kind === "file" && uri.startsWith(AGENT_OUTPUT_DIR))) {
    return null;
  }
  return {
    sessionId,
    path: uri,
    title: typeof name === "string" && name.trim() !== "" ? name : uri,
    addedAt: new Date(typeof createdAt === "string" ? createdAt : 0),
    pinned,
  };
}

/**
 * The files a session's agents made, from Tangent's resource catalog. The
 * ones an agent pinned are finished work, ready to share.
 */
export async function listSessionFiles({
  baseUrl,
  sessionId,
  authToken,
}: SessionRequest): Promise<SessionFileRecord[]> {
  const response = await fetch(sessionUrl(baseUrl, sessionId, "resources"), {
    headers: authHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error(`Couldn't load this session's files (${response.status}).`);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.resources)) {
    throw new Error("Tangent resources response was malformed.");
  }
  return body.resources.flatMap(
    (resource) => parseSessionFile(sessionId, resource) ?? [],
  );
}

export async function pinSessionFile({
  baseUrl,
  sessionId,
  authToken,
  path,
  title,
}: SessionRequest & { path: string; title: string }): Promise<void> {
  const response = await fetch(sessionUrl(baseUrl, sessionId, "pins"), {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify({ path, title }),
  });
  if (!response.ok) {
    throw new Error(`Couldn't pin ${title} (${response.status}).`);
  }
}

export async function unpinSessionFile({
  baseUrl,
  sessionId,
  authToken,
  path,
}: SessionRequest & { path: string }): Promise<void> {
  const response = await fetch(
    sessionUrl(baseUrl, sessionId, `pins?path=${encodeURIComponent(path)}`),
    { method: "DELETE", headers: authHeaders(authToken) },
  );
  if (!response.ok) {
    throw new Error(`Couldn't unpin this file (${response.status}).`);
  }
}

export function sessionFileUrl(
  baseUrl: string,
  sessionId: string,
  path: string,
): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return sessionUrl(baseUrl, sessionId, `files/${encodedPath}`);
}
