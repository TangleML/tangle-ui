import {
  createSecretApiSecretsPost,
  deleteSecretApiSecretsSecretIdDelete,
  listSecretsApiSecretsGet,
  updateSecretApiSecretsSecretIdPut,
} from "@/api/sdk.gen";

import type { Secret } from "./types";

export async function fetchSecretsList() {
  const response = await listSecretsApiSecretsGet();

  if (response.response.status !== 200) {
    // TODO: Handle error
    return [];
  }

  return (
    response.data?.secrets.map(
      (secret) =>
        ({
          id: secret.secret_id,
          name: secret.secret_id,
          createdAt: new Date(), // TODO: Get created at
        }) satisfies Secret,
    ) ?? []
  );
}

export async function updateSecret(
  secretId: string,
  secret: Partial<Secret> & Pick<Secret, "value">,
) {
  const response = await updateSecretApiSecretsSecretIdPut({
    path: {
      secret_id: secretId,
    },
    query: {
      // TODO: Handle undefined value
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
      secret_id: secret.name ?? "",
      secret_value: secret.value ?? "",
    },
  });

  if (response.response.status !== 200) {
    throw new Error(`Failed to add secret: ${response.response.body}`);
  }

  return true;
}

export async function removeSecret(secretId: string) {
  const response = await deleteSecretApiSecretsSecretIdDelete({
    path: {
      secret_id: secretId,
    },
  });

  if (response.response.status !== 200) {
    throw new Error(`Failed to remove secret: ${response.response.body}`);
  }

  return true;
}
