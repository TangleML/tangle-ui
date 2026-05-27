/**
 * Lexical search index for the component library.
 *
 * Pure, synchronous, in-memory. Sub-10ms for hundreds of components. Runs in
 * the browser with no API calls — the foundation for instant typeahead search.
 *
 * Design rationale: the LLM is bad at exact-string matching and slow for any
 * retrieval over a closed set. Local lexical search handles 90% of queries
 * (code names, library names, CLI flags, partial component names) with
 * predictable behavior. The LLM is reserved for *reranking* a small
 * pre-filtered candidate set when judgment is needed — see
 * `naturalLanguageComponentSearchService.ts`.
 */

import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

/** Which field of a component matched the query. Surfaced in the UI. */
type MatchField = "name" | "description" | "io" | "implementation";

/**
 * Where a component came from. Attached to every index entry and threaded
 * through to UI cards as a source badge so users know whether a result is
 * from the curated standard library, the backend's published catalog, a
 * registered external library (e.g. GitHub), or their own user components.
 */
export interface ComponentSource {
  kind: "standard" | "user" | "published" | "registered";
  /** Short label shown in the UI badge (e.g. "Standard", "Published", or a library name). */
  label: string;
  /**
   * Stable identifier for future filter chips / URL state. For built-in kinds
   * this matches the kind; for `registered` libraries it's the stored library id.
   */
  id: string;
}

export interface SourcedReference {
  reference: ComponentReference;
  source: ComponentSource;
}

export interface IndexEntry {
  /** Full reference, kept so callers can render whatever they need. */
  reference: ComponentReference;
  /** Component digest. Stable id for round-tripping (LLM rerank, dedupe). */
  digest: string;
  /** Display name. */
  name: string;
  /** Where this component came from. */
  source: ComponentSource;
  /** Pre-lowercased searchable text, one per logical field. */
  searchable: Record<MatchField, string>;
}

export interface LexicalMatch {
  reference: ComponentReference;
  digest: string;
  name: string;
  source: ComponentSource;
  /** Which fields matched the query (for UX labels like "matched: command"). */
  matchedFields: MatchField[];
}

/**
 * Flatten a container implementation's image + command + args into a single
 * lowercase string. Placeholder objects (e.g. `{ inputValue: "Where" }`) are
 * serialized so library names and flag references inside them remain
 * searchable.
 *
 * Pure container components only — graph components don't have command text.
 */
function extractImplementationText(reference: ComponentReference): string {
  const impl = reference.spec?.implementation;
  if (!impl || !("container" in impl)) return "";
  const container = impl.container;

  const parts: string[] = [];
  if (container.image) parts.push(container.image);

  const pushPart = (part: unknown) => {
    if (typeof part === "string") {
      parts.push(part);
    } else if (part !== null && part !== undefined) {
      try {
        parts.push(JSON.stringify(part));
      } catch {
        // Defensive — skip unserializable values.
      }
    }
  };

  if (Array.isArray(container.command)) {
    for (const p of container.command) pushPart(p);
  }
  if (Array.isArray(container.args)) {
    for (const p of container.args) pushPart(p);
  }

  return parts.join(" ").toLowerCase();
}

/**
 * Build the searchable index from sourced, hydrated component references.
 * References without a digest are skipped (can't round-trip an LLM rerank
 * without one). References with no useful spec metadata are also skipped —
 * they'd just be noise that ranks below every real result.
 */
export function buildSearchIndex(sourced: SourcedReference[]): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const { reference, source } of sourced) {
    if (!reference.digest) continue;

    const spec = reference.spec;
    const description = spec?.description?.trim() ?? "";
    const inputNames =
      spec?.inputs
        ?.map((i) => i.name)
        .filter((n): n is string => typeof n === "string" && n.length > 0) ??
      [];
    const outputNames =
      spec?.outputs
        ?.map((o) => o.name)
        .filter((n): n is string => typeof n === "string" && n.length > 0) ??
      [];

    const hasUsefulMetadata =
      Boolean(spec?.name) ||
      description.length > 0 ||
      inputNames.length > 0 ||
      outputNames.length > 0;
    if (!hasUsefulMetadata) continue;

    const name = getComponentName(reference);

    entries.push({
      reference,
      digest: reference.digest,
      name,
      source,
      searchable: {
        name: name.toLowerCase(),
        description: description.toLowerCase(),
        io: [...inputNames, ...outputNames].join(" ").toLowerCase(),
        implementation: extractImplementationText(reference),
      },
    });
  }

  return entries;
}

/**
 * Split a query into lowercase alphanumeric tokens. `train_test_split` becomes
 * `["train", "test", "split"]` — users almost always type the parts
 * individually, and exact-string matches are still caught by substring search
 * on the original lowercased text.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
}

/**
 * Per-field weights. Name matches are by far the most signal: `train` in the
 * name means the component is *about* training. The same word in implementation
 * text could be a library import in a totally unrelated component.
 */
const FIELD_WEIGHTS: Record<MatchField, number> = {
  name: 5,
  description: 2,
  io: 2,
  implementation: 1,
};

interface SearchOptions {
  /** Max results to return. Default 20. */
  limit?: number;
  /**
   * Minimum query length before any results are returned. Default 1. Set to 2
   * or 3 to suppress noisy results on the first keystroke.
   */
  minLength?: number;
}

/**
 * Score one entry against the tokenized query. Returns 0 if no field matched.
 *
 * Scoring model:
 * - Per query token: each field that contains the token contributes its weight.
 * - Bonus: full multi-token query as a substring of the name (+10). Catches
 *   "train test split" matching `train_test_split` strongly even though we
 *   tokenized.
 *
 * We deliberately do not normalize — raw scores are only used for ordering.
 */
function scoreEntry(
  entry: IndexEntry,
  tokens: string[],
  fullQuery: string,
): { score: number; matchedFields: MatchField[] } {
  const fields: MatchField[] = ["name", "description", "io", "implementation"];
  const matched = new Set<MatchField>();
  let score = 0;

  for (const token of tokens) {
    for (const field of fields) {
      if (entry.searchable[field].includes(token)) {
        score += FIELD_WEIGHTS[field];
        matched.add(field);
      }
    }
  }

  // Multi-token contiguous match in the name is a very strong signal.
  if (tokens.length > 1 && entry.searchable.name.includes(fullQuery)) {
    score += 10;
    matched.add("name");
  }

  return { score, matchedFields: [...matched] };
}

/**
 * Rank index entries against a query. Synchronous, sub-10ms for ~500 entries.
 * Empty/too-short queries return an empty array — callers should show an
 * "all components" or empty-state view instead.
 */
export function lexicalSearch(
  index: IndexEntry[],
  query: string,
  options: SearchOptions = {},
): LexicalMatch[] {
  const { limit = 20, minLength = 1 } = options;
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < minLength) return [];

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return [];

  const scored: Array<LexicalMatch & { score: number }> = [];
  for (const entry of index) {
    const { score, matchedFields } = scoreEntry(entry, tokens, trimmed);
    if (score === 0) continue;
    scored.push({
      reference: entry.reference,
      digest: entry.digest,
      name: entry.name,
      source: entry.source,
      matchedFields,
      score,
    });
  }

  // Stable order: score desc, then name asc for predictable display.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return scored.slice(0, limit).map(({ score: _score, ...m }) => m);
}
