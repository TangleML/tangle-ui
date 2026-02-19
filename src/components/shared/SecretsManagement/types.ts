import type { DynamicDataArgument } from "@/utils/componentSpec";

/**
 * Represents a secret stored in the secrets management system.
 */
export interface Secret {
  id: string;
  name: string;
  value: string;
  createdAt: Date;
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
 * Creates a SecretArgument from a secret name.
 * @param secretName - The name of the secret
 * @returns A SecretArgument object
 */
export function createSecretArgument(secretName: string): DynamicDataArgument {
  return { dynamicData: { secret: { name: secretName } } };
}

/**
 * Extracts the secret name from a SecretArgument.
 * @param arg - The SecretArgument
 * @returns The secret name
 */
export function extractSecretName(arg: DynamicDataArgument): string {
  return arg.dynamicData.secret.name;
}
