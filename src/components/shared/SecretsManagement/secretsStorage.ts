import {
  createSecretApiSecretsPost,
  deleteSecretApiSecretsSecretNameDelete,
  listSecretsApiSecretsGet,
  updateSecretApiSecretsSecretNamePut,
} from "@/api/sdk.gen";

import type { Secret } from "./types";

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

export async function fetchSecretsList() {
  const response = await listSecretsApiSecretsGet();

  if (response.response.status !== 200) {
    throw new Error(`Failed to fetch secrets: ${response.response.body}`);
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

export async function updateSecret(
  secretId: string,
  secret: Partial<Secret> & Pick<Secret, "value">,
) {
  const response = await updateSecretApiSecretsSecretNamePut({
    path: {
      secret_name: secretId,
    },
    body: {
      secret_value: secret.value ?? "",
    },
  });

  if (response.response.status !== 200) {
    throw new Error(`Failed to update secret: ${response.response.body}`);
  }

  return true;
}

export async function addSecret(
  secret: Partial<Secret> & Pick<Secret, "name" | "value">,
) {
  const response = await createSecretApiSecretsPost({
    query: {
      secret_name: secret.name ?? "",
    },
    body: {
      secret_value: secret.value ?? "",
    },
  });

  if (response.response.status !== 200) {
    throw new Error(`Failed to add secret: ${response.response.body}`);
  }

  return true;
}

export async function removeSecret(secretId: string) {
  const response = await deleteSecretApiSecretsSecretNameDelete({
    path: {
      secret_name: secretId,
    },
  });

  if (response.response.status !== 200) {
    throw new Error(`Failed to remove secret: ${response.response.body}`);
  }

  return true;
}
