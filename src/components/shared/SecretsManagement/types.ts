import type {
  DynamicDataArgument,
  SecretArgument,
} from "@/utils/componentSpec";

export interface Secret {
  id: string;
  name: string;
  value?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  description?: string;
}

export function secretNameProblem(name: string): string | null {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) return "Secret name cannot be empty";
  if (name.includes("/")) return "Secret name cannot contain /";
  if (trimmedName === "." || trimmedName === "..") {
    return 'Secret name cannot be "." or ".."';
  }
  return null;
}

export function isValidSecretValue(value: string): boolean {
  return value.length > 0;
}

function isSecretDynamicData(
  dynamicData: DynamicDataArgument["dynamicData"],
): dynamicData is SecretArgument {
  return "secret" in dynamicData;
}

export function createSecretArgument(secretName: string): DynamicDataArgument {
  return { dynamicData: { secret: { name: secretName } } };
}

export function extractSecretName(arg: DynamicDataArgument): string | null {
  if (isSecretDynamicData(arg.dynamicData)) {
    return arg.dynamicData.secret.name;
  }
  return null;
}

export const SecretsQueryKeys = {
  All: (teamId?: string) =>
    teamId
      ? (["secrets", "team", teamId] as const)
      : (["secrets", "user"] as const),
} as const;
