import { getCollabHttpUrl } from "@/services/collaboration/collabServerUrl";
import {
  COLLAB_HTTP_ROUTES,
  type CollabServerInfo,
  isCollabServerInfo,
  isCreateRoomResponse,
} from "@/services/collaboration/serverInfo";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { sanitizeSpecForBackend } from "@/utils/sanitizeSpecForBackend";
import { componentSpecFromYaml } from "@/utils/yaml";

async function readJson(response: Response, action: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(
      `Collaboration server failed to ${action}: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export async function fetchCollabServerInfo(): Promise<CollabServerInfo> {
  const response = await fetch(
    `${getCollabHttpUrl()}${COLLAB_HTTP_ROUTES.info}`,
  );
  const body = await readJson(response, "report its storage mode");
  if (!isCollabServerInfo(body)) {
    throw new Error("Collaboration server returned an unexpected info payload");
  }
  return body;
}

export async function createEphemeralRoom(file: PipelineFile): Promise<string> {
  const spec = sanitizeSpecForBackend(componentSpecFromYaml(await file.read()));

  const response = await fetch(
    `${getCollabHttpUrl()}${COLLAB_HTTP_ROUTES.rooms}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
    },
  );
  const body = await readJson(
    response,
    `create a room for "${file.storageKey}"`,
  );
  if (!isCreateRoomResponse(body)) {
    throw new Error("Collaboration server returned an unexpected room payload");
  }
  return body.roomId;
}
