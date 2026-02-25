import type {
  DynamicDataArgument,
  SecretArgument,
} from "@/utils/componentSpec";

/**
 * Represents a secret stored in the secrets management system.
 */
export interface Secret {
  id: string;
  name: string;
  value?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  description?: string;
}

/**
 * Checks if a secret name is valid.
 */
export function isValidSecretName(name: string): boolean {
  return name.trim().length > 0;
}

/**
 * Checks if a secret value is valid.
 */
export function isValidSecretValue(value: string): boolean {
  return value.length > 0;
}

/**
 * Type guard to check if dynamicData contains a secret.
 */
function isSecretDynamicData(
  dynamicData: DynamicDataArgument["dynamicData"],
): dynamicData is SecretArgument {
  return "secret" in dynamicData;
}

/**
 * Creates a SecretArgument from a secret name.
 * @param secretName - The name of the secret
 * @returns A SecretArgument object
 */
export function createSecretArgument(secretName: string): DynamicDataArgument {
  return { dynamicData: { secret: { name: secretName } } };
}

/**
 * Extracts the secret name from a DynamicDataArgument that contains a secret.
 * @param arg - The DynamicDataArgument containing a secret
 * @returns The secret name, or null if not a secret argument
 */
export function extractSecretName(arg: DynamicDataArgument): string | null {
  if (isSecretDynamicData(arg.dynamicData)) {
    return arg.dynamicData.secret.name;
  }
  return null;
}

/**
 * Query keys for React Query.
 */
export const SecretsQueryKeys = {
  All: () => ["secrets"] as const,
  Id: (id: string) => ["secrets", id] as const,
} as const;
