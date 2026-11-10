import type { EmbedResource } from "@tangent/embed-react";
import type { QueryClient } from "@tanstack/react-query";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";
import {
  tangentAuthHeaders,
  tangentSessionUrl,
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
