import { z } from "zod";

import type { DynamicDataArgument } from "@/utils/componentSpec";

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

const SecretNameSchema = z.string().trim().min(1);
const SecretValueSchema = z.string().min(1);

export function isValidSecretName(name: string): boolean {
  return SecretNameSchema.safeParse(name).success;
}

export function isValidSecretValue(value: string): boolean {
  return SecretValueSchema.safeParse(value).success;
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

/**
 * Query keys for React Query.
 */
export const SecretsQueryKeys = {
  All: () => ["secrets"] as const,
  Id: (id: string) => ["secrets", id] as const,
} as const;
