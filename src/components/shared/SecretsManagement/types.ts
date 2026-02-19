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
