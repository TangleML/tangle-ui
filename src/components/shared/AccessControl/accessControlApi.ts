import { client } from "@/api/client.gen";

export const PIPELINE_ID_ANNOTATION = "tangleml.com/user-pipeline/pipeline-id";

export const BROAD_SCOPES = ["operate", "edit", "manage"] as const;

export type ResourceType = "pipeline" | "schedule" | "trigger" | "pipeline_run";

export type AccessUsers = Record<string, { permissions: string[] }>;

interface AccessHistoryEntry {
  revision: number;
  changed_by: string;
  changed_at: string;
  changes: Record<string, { from: string[]; to: string[] }>;
}

export interface AccessControl {
  owner: string | null;
  users: AccessUsers;
  history: AccessHistoryEntry[];
  revision: number;
  my_scopes: string[];
  warning: string;
}

export class AccessControlApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccessControlApiError";
    this.status = status;
  }
}

function errorMessage(error: unknown, status: number): string {
  const body = (error ?? {}) as { detail?: unknown; message?: unknown };
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.message === "string") return body.message;
  return `Request failed with status ${status}`;
}

export async function getMyScopes(
  type: ResourceType,
  id: string,
): Promise<string[]> {
  const result = await client.get<{ 200: { my_scopes: string[] } }>({
    url: "/api/access_control/{type}/{id}/my_scopes",
    path: { type, id },
  });
  if (!result.data) {
    throw new AccessControlApiError(
      errorMessage(result.error, result.response.status),
      result.response.status,
    );
  }
  return result.data.my_scopes;
}

export async function getAccessControl(
  type: ResourceType,
  id: string,
): Promise<AccessControl> {
  const result = await client.get<{ 200: AccessControl }>({
    url: "/api/access_control/{type}/{id}",
    path: { type, id },
  });
  if (!result.data) {
    throw new AccessControlApiError(
      errorMessage(result.error, result.response.status),
      result.response.status,
    );
  }
  return result.data;
}

export async function updateAccessControl(
  type: ResourceType,
  id: string,
  body: { users: AccessUsers; revision: number },
): Promise<AccessControl> {
  const result = await client.put<{ 200: AccessControl }>({
    url: "/api/access_control/{type}/{id}",
    path: { type, id },
    body,
    headers: { "Content-Type": "application/json" },
  });
  if (!result.data) {
    throw new AccessControlApiError(
      errorMessage(result.error, result.response.status),
      result.response.status,
    );
  }
  return result.data;
}
