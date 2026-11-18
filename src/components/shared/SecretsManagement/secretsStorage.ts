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
import { parseAsUtc } from "@/utils/date";

import { type Secret, SecretsQueryKeys } from "./types";

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
