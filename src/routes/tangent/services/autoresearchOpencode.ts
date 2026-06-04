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
 * GET through the backend OpenCode reverse proxy. Mirrors {@link opencodeProxyPost}
 * but for reads; calls the hey-api client directly so the `{path}` slashes are
 * preserved and the workspace `directory` query is forwarded.
 */
async function opencodeProxyGet(
  instanceId: string,
  path: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const { data, error } = await client.get({
    url: `/api/tangent/instances/${instanceId}/opencode/api/${path}`,
    query,
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

// region Progress polling

/** Live execution state of an OpenCode session (see `session/status.ts`). */
export type SessionStatusType = "idle" | "busy" | "retry";

export type ResearchTodoStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ResearchTodo {
  id: string;
  content: string;
  status: ResearchTodoStatus;
}

export type ResearchPhase =
  | "starting"
  | "working"
  | "retrying"
  | "completed"
  | "failed";

export interface ResearchProgress {
  phase: ResearchPhase;
  statusType: SessionStatusType;
  /** Trimmed snippet of the latest assistant text part. */
  latestText?: string;
  /** Title (or name) of a tool the agent is currently running. */
  currentTool?: string;
  todos: ResearchTodo[];
  messageCount: number;
  /** Latest assistant message timestamp (completed or created), if any. */
  lastUpdated?: number;
  error?: string;
}

function isSessionStatusType(value: unknown): value is SessionStatusType {
  return value === "idle" || value === "busy" || value === "retry";
}

function isResearchTodoStatus(value: unknown): value is ResearchTodoStatus {
  return (
    value === "pending" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "cancelled"
  );
}

/**
 * Read the execution status of a single session. OpenCode prunes idle sessions
 * from the `/session/status` map, so a missing entry is treated as idle.
 */
export async function fetchSessionStatus(
  instanceId: string,
  sessionId: string,
): Promise<SessionStatusType> {
  const data = await opencodeProxyGet(instanceId, "session/status", {
    directory: OPENCODE_WORKSPACE_DIR,
  });

  if (!isRecord(data)) return "idle";
  const entry = data[sessionId];
  if (!isRecord(entry) || !isSessionStatusType(entry.type)) return "idle";
  return entry.type;
}

/**
 * Read the most recent messages (with parts) for a session, newest last. The
 * `limit` keeps the payload small since we only need the latest assistant turn.
 */
export async function fetchSessionMessages(
  instanceId: string,
  sessionId: string,
  limit = 2,
): Promise<unknown> {
  return opencodeProxyGet(instanceId, `session/${sessionId}/message`, {
    directory: OPENCODE_WORKSPACE_DIR,
    limit: String(limit),
  });
}

/** Read the agent's todo checklist for a session. */
export async function fetchSessionTodos(
  instanceId: string,
  sessionId: string,
): Promise<ResearchTodo[]> {
  const data = await opencodeProxyGet(instanceId, `session/${sessionId}/todo`, {
    directory: OPENCODE_WORKSPACE_DIR,
  });

  if (!Array.isArray(data)) return [];

  const todos: ResearchTodo[] = [];
  for (const item of data) {
    if (!isRecord(item)) continue;
    const { id, content, status } = item;
    if (typeof id !== "string") continue;
    if (typeof content !== "string") continue;
    if (!isResearchTodoStatus(status)) continue;
    todos.push({ id, content, status });
  }
  return todos;
}

interface ParsedAssistantMessage {
  completed: boolean;
  error?: string;
  latestText?: string;
  runningTool?: string;
  updatedAt?: number;
}

function extractErrorMessage(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.message === "string") return error.message;
  if (isRecord(error.data) && typeof error.data.message === "string") {
    return error.data.message;
  }
  if (typeof error.name === "string") return error.name;
  return "Unknown error";
}

/** Pull the narration / running tool / completion state from message parts. */
function parseAssistantMessage(message: unknown): ParsedAssistantMessage | null {
  if (!isRecord(message)) return null;
  const { info, parts } = message;
  if (!isRecord(info) || info.role !== "assistant") return null;

  const time = isRecord(info.time) ? info.time : undefined;
  const completedAt =
    time && typeof time.completed === "number" ? time.completed : undefined;
  const createdAt =
    time && typeof time.created === "number" ? time.created : undefined;

  let latestText: string | undefined;
  let runningTool: string | undefined;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (!isRecord(part)) continue;
      if (part.type === "text" && typeof part.text === "string") {
        const text = part.text.trim();
        if (text.length > 0) latestText = text;
        continue;
      }
      if (part.type === "tool" && isRecord(part.state)) {
        if (part.state.status === "running") {
          const title =
            typeof part.state.title === "string" ? part.state.title : undefined;
          const tool = typeof part.tool === "string" ? part.tool : undefined;
          runningTool = title ?? tool;
        }
      }
    }
  }

  return {
    completed: completedAt !== undefined,
    error: extractErrorMessage(info.error),
    latestText,
    runningTool,
    updatedAt: completedAt ?? createdAt,
  };
}

function findLatestAssistantMessage(
  messages: unknown,
): ParsedAssistantMessage | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const parsed = parseAssistantMessage(messages[i]);
    if (parsed) return parsed;
  }
  return null;
}

function derivePhase(
  statusType: SessionStatusType,
  assistant: ParsedAssistantMessage | null,
): ResearchPhase {
  if (statusType === "busy") return "working";
  if (statusType === "retry") return "retrying";
  if (assistant?.error) return "failed";
  if (assistant?.completed) return "completed";
  return "starting";
}

/**
 * Combine session status, the latest messages, and todos into a single
 * progress snapshot for the UI. Pure and tolerant of unknown shapes.
 */
export function deriveResearchProgress(
  statusType: SessionStatusType,
  messages: unknown,
  todos: ResearchTodo[],
): ResearchProgress {
  const assistant = findLatestAssistantMessage(messages);
  const messageCount = Array.isArray(messages) ? messages.length : 0;

  return {
    phase: derivePhase(statusType, assistant),
    statusType,
    latestText: assistant?.latestText,
    currentTool: assistant?.runningTool,
    todos,
    messageCount,
    lastUpdated: assistant?.updatedAt,
    error: assistant?.error,
  };
}

export function isResearchPhaseTerminal(phase: ResearchPhase): boolean {
  return phase === "completed" || phase === "failed";
}

// endregion
