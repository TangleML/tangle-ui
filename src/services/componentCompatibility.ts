import type { ComponentReference, TypeSpecType } from "@/utils/componentSpec";

type ComponentCompatibilityDirection = "upstream" | "downstream";

export interface CompatibleComponentSuggestion {
  direction: ComponentCompatibilityDirection;
  reference: ComponentReference;
  matchedTypes: string[];
}

function sortTypeObject(type: TypeSpecType): TypeSpecType {
  if (typeof type === "string") return type;

  return Object.fromEntries(
    Object.entries(type)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, sortTypeObject(value)]),
  );
}

function stableStringifyType(type: TypeSpecType): string {
  return JSON.stringify(sortTypeObject(type));
}

function normalizeType(type: TypeSpecType | undefined): string | undefined {
  if (typeof type === "string") {
    const normalized = type.trim().toLowerCase();
    return normalized && normalized !== "any" ? normalized : undefined;
  }
  if (!type) return undefined;

  const normalized = stableStringifyType(type).toLowerCase();
  return normalized === "{}" ? undefined : normalized;
}

function uniqueTypes(types: Array<string | undefined>): string[] {
  return [...new Set(types.filter((type): type is string => Boolean(type)))];
}

function intersectTypes(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter((type) => bSet.has(type));
}

export function buildCompatibleComponentSuggestions(
  selected: ComponentReference | undefined,
  candidates: ComponentReference[],
  { limit = 6 }: { limit?: number } = {},
): CompatibleComponentSuggestion[] {
  const selectedSpec = selected?.spec;
  if (!selected?.digest || !selectedSpec) return [];

  const selectedInputTypes = uniqueTypes(
    selectedSpec.inputs?.map((input) => normalizeType(input.type)) ?? [],
  );
  const selectedOutputTypes = uniqueTypes(
    selectedSpec.outputs?.map((output) => normalizeType(output.type)) ?? [],
  );
  if (selectedInputTypes.length === 0 && selectedOutputTypes.length === 0) {
    return [];
  }

  const suggestions: CompatibleComponentSuggestion[] = [];
  for (const candidate of candidates) {
    if (!candidate.digest || candidate.digest === selected.digest) continue;
    const candidateSpec = candidate.spec;
    if (!candidateSpec) continue;

    const candidateInputTypes = uniqueTypes(
      candidateSpec.inputs?.map((input) => normalizeType(input.type)) ?? [],
    );
    const candidateOutputTypes = uniqueTypes(
      candidateSpec.outputs?.map((output) => normalizeType(output.type)) ?? [],
    );

    const downstreamTypes = intersectTypes(
      selectedOutputTypes,
      candidateInputTypes,
    );
    if (downstreamTypes.length > 0) {
      suggestions.push({
        direction: "downstream",
        reference: candidate,
        matchedTypes: downstreamTypes,
      });
    }

    const upstreamTypes = intersectTypes(
      candidateOutputTypes,
      selectedInputTypes,
    );
    if (upstreamTypes.length > 0) {
      suggestions.push({
        direction: "upstream",
        reference: candidate,
        matchedTypes: upstreamTypes,
      });
    }

    if (suggestions.length >= limit) break;
  }

  return suggestions.slice(0, limit);
}
