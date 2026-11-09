import { isRecord } from "@/utils/typeGuards";

export interface SessionFileRecord {
  sessionId: string;
  path: string;
  title: string;
  addedAt: Date;
}

interface ListSessionFilesParams {
  baseUrl: string;
  sessionId: string;
  authToken?: string;
}

function parsePinnedFile(
  sessionId: string,
  value: unknown,
): SessionFileRecord | null {
  if (!isRecord(value)) return null;
  const { kind, uri, name, createdAt } = value;
  if (kind !== "artifact" || typeof uri !== "string" || uri === "") {
    return null;
  }
  return {
    sessionId,
    path: uri,
    title: typeof name === "string" && name.trim() !== "" ? name : uri,
    addedAt: new Date(typeof createdAt === "string" ? createdAt : 0),
  };
}

/** The files a session's agents pinned, from Tangent's resource catalog. */
export async function listSessionFiles({
  baseUrl,
  sessionId,
  authToken,
}: ListSessionFilesParams): Promise<SessionFileRecord[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(sessionId)}/resources`;
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Couldn't load this session's files (${response.status}).`);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.resources)) {
    throw new Error("Tangent resources response was malformed.");
  }
  return body.resources.flatMap(
    (resource) => parsePinnedFile(sessionId, resource) ?? [],
  );
}

export function sessionFileUrl(
  baseUrl: string,
  sessionId: string,
  path: string,
): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(sessionId)}/files/${encodedPath}`;
}
