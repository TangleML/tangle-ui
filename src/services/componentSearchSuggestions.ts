import type { IndexEntry } from "@/services/componentSearchIndex";
import type { ComponentReference, TypeSpecType } from "@/utils/componentSpec";

const DEFAULT_COMPONENT_SEARCH_SUGGESTIONS = [
  "csv",
  "train",
  "predict",
  "dataframe",
] as const;

const NOISY_SUGGESTION_TOKENS = new Set([
  "component",
  "components",
  "library",
  "standard",
  "published",
  "user",
  "input",
  "inputs",
  "output",
  "outputs",
  "string",
  "integer",
  "number",
  "boolean",
  "float",
  "double",
  "object",
  "python",
]);

type ComponentSearchSuggestionKind = "default" | "name" | "source" | "type";

export interface ComponentSearchSuggestion {
  label: string;
  kind: ComponentSearchSuggestionKind;
}

interface ScoredSuggestion extends ComponentSearchSuggestion {
  score: number;
}

function normalizeToken(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 24) return undefined;
  if (NOISY_SUGGESTION_TOKENS.has(normalized)) return undefined;
  if (!/[a-z]/.test(normalized)) return undefined;
  return normalized;
}

function splitSuggestionTokens(value: string): string[] {
  const camelSplit = value.replace(/([a-z])([A-Z])/g, "$1 $2");
  return camelSplit
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => normalizeToken(token))
    .filter((token): token is string => token !== undefined);
}

function typeToTokens(type: TypeSpecType | undefined): string[] {
  if (typeof type === "string") return splitSuggestionTokens(type);
  if (!type) return [];
  return splitSuggestionTokens(JSON.stringify(type));
}

function sourceLabelToSuggestion(label: string): string | undefined {
  const normalized = label.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 28) return undefined;
  if (normalized.includes("@") || normalized.includes("/")) return undefined;
  if (NOISY_SUGGESTION_TOKENS.has(normalized)) return undefined;
  return normalized;
}

function addSuggestion(
  suggestions: Map<string, ScoredSuggestion>,
  label: string,
  kind: ComponentSearchSuggestionKind,
  score: number,
) {
  const current = suggestions.get(label);
  if (!current || score > current.score) {
    suggestions.set(label, {
      label,
      kind,
      score: (current?.score ?? 0) + score,
    });
  } else {
    current.score += score;
  }
}

function addReferenceSuggestions(
  suggestions: Map<string, ScoredSuggestion>,
  reference: ComponentReference,
) {
  for (const input of reference.spec?.inputs ?? []) {
    for (const token of typeToTokens(input.type)) {
      addSuggestion(suggestions, token, "type", 4);
    }
  }

  for (const output of reference.spec?.outputs ?? []) {
    for (const token of typeToTokens(output.type)) {
      addSuggestion(suggestions, token, "type", 4);
    }
  }

  for (const token of splitSuggestionTokens(reference.name ?? "")) {
    addSuggestion(suggestions, token, "name", 1);
  }
}

export function buildComponentSearchSuggestions(
  index: IndexEntry[],
  {
    includeSources = true,
    limit = 4,
    query = "",
  }: { includeSources?: boolean; limit?: number; query?: string } = {},
): ComponentSearchSuggestion[] {
  const suggestions = new Map<string, ScoredSuggestion>();
  const queryTokens = new Set(splitSuggestionTokens(query));

  for (const entry of index) {
    addReferenceSuggestions(suggestions, entry.reference);

    if (includeSources && entry.source.kind === "registered") {
      const sourceSuggestion = sourceLabelToSuggestion(entry.source.label);
      if (sourceSuggestion) {
        addSuggestion(suggestions, sourceSuggestion, "source", 3);
      }
    }
  }

  DEFAULT_COMPONENT_SEARCH_SUGGESTIONS.forEach((label, index) => {
    addSuggestion(suggestions, label, "default", 0.5 - index * 0.01);
  });

  return Array.from(suggestions.values())
    .filter((suggestion) => !queryTokens.has(suggestion.label))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ label, kind }) => ({ label, kind }));
}
