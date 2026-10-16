import { isRecord } from "@/utils/typeGuards";

/**
 * Mirrors Tangent's `RemoteEnvironmentInfo`: a connected host (a VS Code
 * window, an embed host) that can run a session's remote sub-agents and tools.
 */
export interface TangentEnvironment {
  environmentId: string;
  sessionId?: string;
  owner?: string;
  scoped: boolean;
  toolCount: number;
  subagentCount: number;
  metadata?: Record<string, string>;
}

interface ListTangentEnvironmentsParams {
  baseUrl: string;
  sessionId: string;
  authToken?: string;
}

function parseMetadata(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseEnvironment(value: unknown): TangentEnvironment | null {
  if (!isRecord(value)) return null;
  const {
    environmentId,
    sessionId,
    owner,
    scoped,
    toolCount,
    subagentCount,
    metadata,
  } = value;
  if (typeof environmentId !== "string" || environmentId.length === 0) {
    return null;
  }
  const parsedMetadata = parseMetadata(metadata);
  return {
    environmentId,
    ...(typeof sessionId === "string" ? { sessionId } : {}),
    ...(typeof owner === "string" ? { owner } : {}),
    scoped: scoped === true,
    toolCount: typeof toolCount === "number" ? toolCount : 0,
    subagentCount: typeof subagentCount === "number" ? subagentCount : 0,
    ...(parsedMetadata ? { metadata: parsedMetadata } : {}),
  };
}

function parseEnvironmentsResponse(value: unknown): TangentEnvironment[] {
  if (!isRecord(value) || !Array.isArray(value.environments)) {
    throw new Error("Tangent environments response was malformed.");
  }
  return value.environments
    .map(parseEnvironment)
    .filter((environment) => environment !== null);
}

export async function listTangentEnvironments({
  baseUrl,
  sessionId,
  authToken,
}: ListTangentEnvironmentsParams): Promise<TangentEnvironment[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(sessionId)}/environments`;
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to list Tangent environments (${response.status} ${response.statusText}).`,
    );
  }
  return parseEnvironmentsResponse(await response.json());
}
