import type { EmbedResource } from "@tangent/embed-react";
import type { QueryClient } from "@tanstack/react-query";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";
import {
  tangentAuthHeaders,
  tangentSessionUrl,
  tangentUrl,
} from "@/routes/v2/pages/Tangent/services/tangentApi";

export interface SessionFileRecord {
  sessionId: string;
  path: string;
  title: string;
  addedAt: Date;
  pinned: boolean;
}

interface SessionFileRequest {
  baseUrl: string;
  sessionId: string;
  authToken?: string;
  path: string;
  title: string;
}

const AGENT_OUTPUT_DIR = "artifacts/";

/**
 * The files a chat's agents made, from its resources. A file an agent pinned
 * is always listed, as finished work ready to share; any other file counts
 * only when it sits in `artifacts/`, where agents write what they make.
 * Uploads, memory and host entries are someone else's.
 */
export function sessionFilesOf(
  sessionId: string,
  resources: EmbedResource[],
): SessionFileRecord[] {
  return resources.flatMap(({ kind, uri, name, createdAt }) => {
    const pinned = kind === "artifact";
    if (uri === "") return [];
    if (!pinned && !(kind === "file" && uri.startsWith(AGENT_OUTPUT_DIR))) {
      return [];
    }
    return [
      {
        sessionId,
        path: uri,
        title: name.trim() === "" ? uri : name,
        addedAt: new Date(createdAt),
        pinned,
      },
    ];
  });
}

async function pinSessionFile({
  baseUrl,
  sessionId,
  authToken,
  path,
  title,
}: SessionFileRequest): Promise<void> {
  const response = await fetch(tangentSessionUrl(baseUrl, sessionId, "pins"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...tangentAuthHeaders(authToken),
    },
    body: JSON.stringify({ path, title }),
  });
  if (!response.ok) {
    throw new Error(`Couldn't pin ${title} (${response.status}).`);
  }
}

async function unpinSessionFile({
  baseUrl,
  sessionId,
  authToken,
  path,
}: SessionFileRequest): Promise<void> {
  const response = await fetch(
    tangentSessionUrl(
      baseUrl,
      sessionId,
      `pins?path=${encodeURIComponent(path)}`,
    ),
    { method: "DELETE", headers: tangentAuthHeaders(authToken) },
  );
  if (!response.ok) {
    throw new Error(`Couldn't unpin this file (${response.status}).`);
  }
}

/** Pins a file to the project's reports or takes it out, for everyone. */
export async function setSessionFilePinned(
  queryClient: QueryClient,
  request: SessionFileRequest,
  pinned: boolean,
): Promise<void> {
  await (pinned ? pinSessionFile(request) : unpinSessionFile(request));
  await queryClient.invalidateQueries({
    queryKey: sessionResourcesKey(request.sessionId),
  });
}

export function sessionFileUrl(
  baseUrl: string,
  sessionId: string,
  path: string,
): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return tangentSessionUrl(baseUrl, sessionId, `files/${encodedPath}`);
}

function pathUnderTangentSessions(
  url: string,
  baseUrl: string,
): string | undefined {
  let address: URL;
  let sessions: URL;
  try {
    address = new URL(url);
    sessions = new URL(tangentUrl(baseUrl, "/api/sessions/"));
  } catch {
    return undefined;
  }
  // Addresses without a host, `data:` and the like, all share the origin "null".
  if (sessions.origin === "null" || address.origin !== sessions.origin) {
    return undefined;
  }
  return address.pathname.startsWith(sessions.pathname)
    ? address.pathname.slice(sessions.pathname.length)
    : undefined;
}

/**
 * Whether an address is one of this Tangent's own session addresses. A tab
 * shows whatever its address serves and comes back on every visit, so one an
 * agent was talked into opening must not be able to point anywhere else.
 */
export function isTangentSessionUrl(url: string, baseUrl: string): boolean {
  return pathUnderTangentSessions(url, baseUrl) !== undefined;
}

export function sessionIdOfFileUrl(
  url: string,
  baseUrl: string,
): string | undefined {
  const path = pathUnderTangentSessions(url, baseUrl);
  const encoded = path && /^([^/]+)\/files\//.exec(path)?.[1];
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}
