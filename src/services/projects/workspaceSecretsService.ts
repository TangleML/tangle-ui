import { client } from "@/api/client.gen";
import { describeErrorBody } from "@/services/requestFailureMessage";

import { WorkspaceSecretsApiError } from "./errors";
import type {
  CreateWorkspaceSecretInput,
  ReplaceWorkspaceSecretInput,
  WorkspaceSecret,
  WorkspaceSecretList,
} from "./types";

interface WorkspaceSecretDto {
  secret_name: string;
  description: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  can_manage: boolean;
}

interface WorkspaceSecretListDto {
  secrets: WorkspaceSecretDto[];
  can_create: boolean;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function mapWorkspaceSecret(dto: WorkspaceSecretDto): WorkspaceSecret {
  return {
    name: dto.secret_name,
    description: dto.description,
    expiresAt: dto.expires_at ? new Date(dto.expires_at) : null,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
    createdBy: dto.created_by,
    canManage: dto.can_manage,
  };
}

function refusal(
  failure: string,
  result: { error: unknown; response: Response },
): WorkspaceSecretsApiError {
  const reason = describeErrorBody(result.error);
  return new WorkspaceSecretsApiError(
    reason ? `${failure}: ${reason}` : failure,
    result.response.status,
  );
}

export async function listWorkspaceSecrets(
  workspaceId: string,
): Promise<WorkspaceSecretList> {
  const result = await client.get<{ 200: WorkspaceSecretListDto }, unknown>({
    url: "/api/workspaces/{workspace_id}/secrets/",
    path: { workspace_id: workspaceId },
  });
  if (!result.data) {
    throw refusal("Failed to load secrets", result);
  }
  return {
    secrets: result.data.secrets.map(mapWorkspaceSecret),
    canCreate: result.data.can_create,
  };
}

export async function createWorkspaceSecret(
  workspaceId: string,
  input: CreateWorkspaceSecretInput,
): Promise<WorkspaceSecret> {
  const result = await client.post<{ 200: WorkspaceSecretDto }, unknown>({
    url: "/api/workspaces/{workspace_id}/secrets/",
    path: { workspace_id: workspaceId },
    body: {
      secret_name: input.name,
      secret_value: input.value,
      description: input.description,
      expires_at: input.expiresAt,
    },
    headers: JSON_HEADERS,
  });
  if (!result.data) {
    throw refusal("Failed to add secret", result);
  }
  return mapWorkspaceSecret(result.data);
}

export async function replaceWorkspaceSecret(
  workspaceId: string,
  secretName: string,
  input: ReplaceWorkspaceSecretInput,
): Promise<WorkspaceSecret> {
  const result = await client.put<{ 200: WorkspaceSecretDto }, unknown>({
    url: "/api/workspaces/{workspace_id}/secrets/{secret_name}",
    path: { workspace_id: workspaceId, secret_name: secretName },
    body: {
      secret_value: input.value,
      description: input.description,
      expires_at: input.expiresAt,
    },
    headers: JSON_HEADERS,
  });
  if (!result.data) {
    throw refusal("Failed to replace secret", result);
  }
  return mapWorkspaceSecret(result.data);
}

export async function deleteWorkspaceSecret(
  workspaceId: string,
  secretName: string,
): Promise<void> {
  const result = await client.delete<{ 204: void }, unknown>({
    url: "/api/workspaces/{workspace_id}/secrets/{secret_name}",
    path: { workspace_id: workspaceId, secret_name: secretName },
  });
  if (!result.response.ok) {
    throw refusal("Failed to delete secret", result);
  }
}
