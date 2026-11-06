import {
  createSecretApiSecretsPost,
  deleteSecretApiSecretsSecretNameDelete,
  listSecretsApiSecretsGet,
  updateSecretApiSecretsSecretNamePut,
} from "@/api/sdk.gen";
import {
  isTourMockActive,
  mockAddSecret,
  mockListSecrets,
  mockRemoveSecret,
  mockUpdateSecret,
} from "@/providers/TourProvider/tourMockBackend";
import { ApiError } from "@/services/projects/errors";
import { describeErrorBody } from "@/services/requestFailureMessage";
import {
  readImpersonationRefusal,
  TeamImpersonationError,
} from "@/services/teams/errors";
import { teamRequestHeaders } from "@/services/teams/teamRequestHeaders";

import { type Secret, SecretsQueryKeys } from "./types";

/**
 * Parses a date string, assuming UTC if no timezone is specified.
 * Handles cases where the server may or may not include timezone info.
 */
function parseAsUtc(dateString: string): Date {
  // Already has UTC indicator
  if (dateString.endsWith("Z")) {
    return new Date(dateString);
  }

  // Has positive timezone offset (e.g., +05:00)
  if (dateString.includes("+")) {
    return new Date(dateString);
  }

  // Check for negative timezone offset by looking for - after the date portion
  // ISO date format: YYYY-MM-DD (positions 0-9), so any - after index 9 is timezone
  if (dateString.lastIndexOf("-") > 9) {
    return new Date(dateString);
  }

  // No timezone info detected, assume UTC
  return new Date(dateString + "Z");
}

export class SecretsApiError extends ApiError {
  constructor(message: string, status: number) {
    super("SecretsApiError", message, status);
  }
}

function secretsFailure(
  action: string,
  result: { error: unknown; response: Response },
): ApiError {
  const status = result.response.status;
  const refusal = readImpersonationRefusal(result.error);
  if (refusal) {
    return new TeamImpersonationError(refusal, status);
  }

  const reason = describeErrorBody(result.error);
  return new SecretsApiError(reason ? `${action}: ${reason}` : action, status);
}

export async function fetchSecretsList(teamId?: string) {
  if (isTourMockActive()) {
    return mockListSecrets();
  }

  const response = await listSecretsApiSecretsGet({
    headers: teamRequestHeaders(teamId),
  });

  if (response.response.status !== 200) {
    throw secretsFailure("Failed to fetch secrets", response);
  }

  return (
    response.data?.secrets.map(
      (secret) =>
        ({
          id: secret.secret_name,
          name: secret.secret_name,
          createdAt: parseAsUtc(secret.created_at),
          updatedAt: parseAsUtc(secret.updated_at),
          expiresAt: secret.expires_at
            ? parseAsUtc(secret.expires_at)
            : undefined,
          description: secret.description ?? undefined,
        }) satisfies Secret,
    ) ?? []
  );
}

export function secretsListQuery(teamId?: string) {
  return {
    queryKey: SecretsQueryKeys.All(teamId),
    queryFn: () => fetchSecretsList(teamId),
  };
}

export async function updateSecret(
  secretId: string,
  secret: Partial<Secret> & Pick<Secret, "value">,
  teamId?: string,
) {
  if (isTourMockActive()) {
    mockUpdateSecret(secretId, secret.value);
    return true;
  }

  const response = await updateSecretApiSecretsSecretNamePut({
    path: {
      secret_name: secretId,
    },
    query: {
      description: secret.description,
      expires_at: secret.expiresAt?.toISOString(),
    },
    body: {
      secret_value: secret.value ?? "",
    },
    headers: teamRequestHeaders(teamId),
  });

  if (response.response.status !== 200) {
    throw secretsFailure("Failed to update secret", response);
  }

  return true;
}

export async function addSecret(
  secret: Partial<Secret> & Pick<Secret, "name" | "value">,
  teamId?: string,
) {
  if (isTourMockActive()) {
    mockAddSecret(secret.name ?? "", secret.value);
    return true;
  }

  const response = await createSecretApiSecretsPost({
    query: {
      secret_name: secret.name ?? "",
      description: secret.description,
      expires_at: secret.expiresAt?.toISOString(),
    },
    body: {
      secret_value: secret.value ?? "",
    },
    headers: teamRequestHeaders(teamId),
  });

  if (response.response.status !== 200) {
    throw secretsFailure("Failed to add secret", response);
  }

  return true;
}

export async function removeSecret(secretId: string, teamId?: string) {
  if (isTourMockActive()) {
    mockRemoveSecret(secretId);
    return true;
  }

  const response = await deleteSecretApiSecretsSecretNameDelete({
    path: {
      secret_name: secretId,
    },
    headers: teamRequestHeaders(teamId),
  });

  if (response.response.status !== 200) {
    throw secretsFailure("Failed to remove secret", response);
  }

  return true;
}
