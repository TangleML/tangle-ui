import { client } from "@/api/client.gen";
import {
  createInstanceApiTangentInstancesPost,
  listInstancesApiTangentInstancesGet,
} from "@/api/sdk.gen";
import { API_URL } from "@/utils/constants";

/**
 * Workspace directory the OpenCode agent runs in. OpenCode scopes sessions to
 * a directory, passed as the `directory` query param (base64 `L3Jvb3Qvd29ya3NwYWNl`
 * in the web UI URL).
 */
const OPENCODE_WORKSPACE_DIR = "/root/workspace";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface OpencodeProxyPostOptions {
  query?: Record<string, string>;
  body?: unknown;
}

/**
 * POST through the backend OpenCode reverse proxy
 * (`/api/tangent/instances/{instanceId}/opencode/api/{path}`), which forwards
 * the path, query string, and body to the in-pod OpenCode server.
 *
 * We call the hey-api client directly rather than the generated proxy fn so the
 * `{path}` segment keeps its slashes (the generated fn would URL-encode them)
 * and so we can attach a query and body.
 */
async function opencodeProxyPost(
  instanceId: string,
  path: string,
  { query, body }: OpencodeProxyPostOptions = {},
): Promise<unknown> {
  const { data, error } = await client.post({
    url: `/api/tangent/instances/${instanceId}/opencode/api/${path}`,
    query,
    body,
  });

  if (error) {
    throw new Error(
      `OpenCode request failed (${path}): ${JSON.stringify(error)}`,
    );
  }

  return data;
}

/**
 * Resolve a Tangent OpenCode instance to talk to, mirroring the backend
 * `/api/tangent/go` logic: reuse the earliest existing instance, otherwise
 * create one.
 */
export async function resolveInstanceId(): Promise<string> {
  const { data, error } = await listInstancesApiTangentInstancesGet();
  if (error) {
    throw new Error(
      `Failed to list Tangent instances: ${JSON.stringify(error)}`,
    );
  }

  const instanceIds = (data?.instances ?? [])
    .map((instance) => instance.instance_id)
    .sort();
  if (instanceIds.length > 0) {
    return instanceIds[0];
  }

  const created = await createInstanceApiTangentInstancesPost();
  if (created.error || !created.data) {
    throw new Error(
      `Failed to create Tangent instance: ${JSON.stringify(created.error)}`,
    );
  }
  return created.data.instance_id;
}

/**
 * Create a fresh OpenCode session in the workspace directory and return its id.
 */
export async function createOpencodeSession(
  instanceId: string,
  title: string,
): Promise<string> {
  const data = await opencodeProxyPost(instanceId, "session", {
    query: { directory: OPENCODE_WORKSPACE_DIR },
    body: { title },
  });

  if (!isRecord(data) || typeof data.id !== "string") {
    throw new Error("OpenCode session response did not include an id");
  }
  return data.id;
}

/**
 * Build the OpenCode web UI URL for following a created session, mirroring the
 * structure produced by the backend redirect. The base resolves to the
 * configured backend (or the current origin in relative-path mode).
 */
export function buildOpencodeSessionUrl(
  instanceId: string,
  sessionId: string,
): string {
  const base = API_URL || window.location.origin;
  return `${base}/api/tangent/instances/${instanceId}/opencode/app/default/Lw/session/${sessionId}`;
}

/**
 * Send a prompt to an OpenCode session without waiting for the agent to finish
 * (fire-and-forget via `prompt_async`).
 */
export async function sendAutoresearchMessage(
  instanceId: string,
  sessionId: string,
  text: string,
): Promise<void> {
  await opencodeProxyPost(instanceId, `session/${sessionId}/prompt_async`, {
    query: { directory: OPENCODE_WORKSPACE_DIR },
    body: { parts: [{ type: "text", text }] },
  });
}
