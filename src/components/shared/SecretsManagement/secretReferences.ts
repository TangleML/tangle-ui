import { isSecretArgument } from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";

import { extractSecretName, type Secret } from "./types";

function collectSecretNames(value: unknown, names: Set<string>) {
  if (isSecretArgument(value)) {
    const name = extractSecretName(value);
    if (name) names.add(name);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSecretNames(item, names);
    return;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) collectSecretNames(item, names);
  }
}

export function referencedSecretNames(...sources: unknown[]): string[] {
  const names = new Set<string>();
  for (const source of sources) collectSecretNames(source, names);
  return [...names];
}

export function missingSecretNames(
  referenced: readonly string[],
  available: readonly Pick<Secret, "name">[],
): string[] {
  const availableNames = new Set(available.map((secret) => secret.name));
  return referenced.filter((name) => !availableNames.has(name));
}
