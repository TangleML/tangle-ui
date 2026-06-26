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

import { expandSynonymTokens } from "./componentSearchSynonyms";

/** Which field of a component matched the query. Surfaced in the UI. */
export type MatchField =
  | "name"
  | "description"
  | "io"
  | "implementation"
  | "metadata";

/**
 * Where a component came from. Attached to every index entry and threaded
 * through to UI cards as a source badge so users know whether a result is
 * from the curated standard library, the backend's published catalog, a
 * registered external library (e.g. GitHub), or their own user components.
 */
export interface ComponentSearchSource {
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
  source: ComponentSearchSource;
}

export interface IndexEntry {
  /** Full reference, kept so callers can render whatever they need. */
  reference: ComponentReference;
  /** Component digest. Stable id for round-tripping (LLM rerank, dedupe). */
  digest: string;
  /** Display name. */
  name: string;
  /** Where this component came from. */
  source: ComponentSearchSource;
  /** Normalized searchable text, one per logical field. */
  searchable: Record<MatchField, string>;
}

export interface LexicalMatch {
  reference: ComponentReference;
  digest: string;
  name: string;
  source: ComponentSearchSource;
  /** Which fields matched the query (for UX labels like "matched: command"). */
  matchedFields: MatchField[];
}

export function indexEntryToLexicalMatch(entry: IndexEntry): LexicalMatch {
  return {
    reference: entry.reference,
    digest: entry.digest,
    name: entry.name,
    source: entry.source,
    matchedFields: [],
  };
}

const ANNOTATION_KEYS_EXCLUDED_FROM_SEARCH = new Set([
  "editor.position",
  "editor.collapsed",
  "editor.flow-direction",
  "flex-nodes",
  "python_original_code",
  "tangleml.com/editor/task-color",
  "tangleml.com/editor/edge-conduits",
  "zIndex",
]);

const MAX_ANNOTATION_TEXT_LENGTH = 500;
const MAX_ANNOTATION_TOTAL_TEXT_LENGTH = 2_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringifySearchValue(value: unknown): string {
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return String(value);
    case "undefined":
      return "";
    default:
      if (value === null) return "";
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
  }
}

function splitIdentifierText(text: string): string {
  return text
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
}

function removeSuffixAndCollapseDoubleFinal(
  token: string,
  suffixLength: number,
): string {
  const stemmed = token.slice(0, -suffixLength);
  if (stemmed.length < 3) return stemmed;

  const last = stemmed.at(-1);
  const previous = stemmed.at(-2);
  return last && last === previous ? stemmed.slice(0, -1) : stemmed;
}

// Deliberately lossy search heuristic, not a full Porter stemmer.
function stemToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ing") && token.length > 5) {
    return removeSuffixAndCollapseDoubleFinal(token, 3);
  }
  if (token.endsWith("ed") && token.length > 4) {
    return removeSuffixAndCollapseDoubleFinal(token, 2);
  }
  if (/(ches|shes|xes|zes|ses)$/.test(token) && token.length > 4) {
    return token.slice(0, -2);
  }
  if (
    token.endsWith("s") &&
    !token.endsWith("ss") &&
    !token.endsWith("is") &&
    !token.endsWith("us") &&
    token.length > 3
  ) {
    return token.slice(0, -1);
  }
  return token;
}

function baseSearchTokens(text: string): string[] {
  const splitText = splitIdentifierText(text).toLowerCase();
  const tokens = splitText.split(/[^a-z0-9]+/).filter(isNonEmptyString);
  const expandedTokens: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    for (const variant of [token, stemToken(token)]) {
      if (seen.has(variant)) continue;
      seen.add(variant);
      expandedTokens.push(variant);
    }
  }

  return expandedTokens;
}

function normalizeSearchText(text: string): string {
  const splitText = splitIdentifierText(text).toLowerCase();
  // Synonym expansion happens on the query side only (see `tokenize`). Expanding
  // the index too would make a query token set intersect a ballooned index token
  // set, surfacing components that match neither the literal text nor the intent.
  return [text.toLowerCase(), splitText, baseSearchTokens(text).join(" ")].join(
    " ",
  );
}

function extractAnnotationsText(
  annotations: Record<string, unknown> | undefined,
): string {
  if (!annotations) return "";

  const parts: string[] = [];
  let textLength = 0;
  for (const [key, value] of Object.entries(annotations)) {
    if (ANNOTATION_KEYS_EXCLUDED_FROM_SEARCH.has(key)) continue;

    const valueText = stringifySearchValue(value).trim();
    if (!valueText || valueText.length > MAX_ANNOTATION_TEXT_LENGTH) continue;

    const part = `${key} ${valueText}`;
    const nextLength = textLength + (parts.length > 0 ? 1 : 0) + part.length;
    if (nextLength > MAX_ANNOTATION_TOTAL_TEXT_LENGTH) break;

    parts.push(part);
    textLength = nextLength;
  }

  return parts.join(" ");
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
 * Common projection of a `ComponentReference` into the fields used downstream
 * by both the lexical index and the LLM reranker. Returns `null` when the
 * reference has no digest or no useful metadata — both consumers want to
 * skip such references for the same reason (un-roundtrippable / noise).
 */
export interface ComponentMetadata {
  digest: string;
  name: string;
  /** Trimmed; empty string when missing. */
  description: string;
  inputNames: string[];
  outputNames: string[];
  /** Names, descriptions, types, and annotations for inputs/outputs. */
  ioText: string;
  /** Searchable component-level metadata annotations. */
  metadataText: string;
}

export function extractComponentMetadata(
  reference: ComponentReference,
): ComponentMetadata | null {
  if (!reference.digest) return null;
  const spec = reference.spec;
  const description = spec?.description?.trim() ?? "";
  const inputNames =
    spec?.inputs?.map((input) => input.name).filter(isNonEmptyString) ?? [];
  const outputNames =
    spec?.outputs?.map((output) => output.name).filter(isNonEmptyString) ?? [];
  const ioText = [...(spec?.inputs ?? []), ...(spec?.outputs ?? [])]
    .flatMap((ioSpec) => [
      ioSpec.name,
      ioSpec.description,
      stringifySearchValue(ioSpec.type),
      extractAnnotationsText(ioSpec.annotations),
    ])
    .filter(isNonEmptyString)
    .join(" ");
  const metadataText = extractAnnotationsText(spec?.metadata?.annotations);
  const hasUsefulMetadata =
    Boolean(spec?.name) ||
    description.length > 0 ||
    ioText.length > 0 ||
    metadataText.length > 0;
  if (!hasUsefulMetadata) return null;
  return {
    digest: reference.digest,
    name: getComponentName(reference),
    description,
    inputNames,
    outputNames,
    ioText,
    metadataText,
  };
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
    const metadata = extractComponentMetadata(reference);
    if (!metadata) continue;

    entries.push({
      reference,
      digest: metadata.digest,
      name: metadata.name,
      source,
      searchable: {
        name: normalizeSearchText(metadata.name),
        description: normalizeSearchText(metadata.description),
        io: normalizeSearchText(metadata.ioText),
        implementation: normalizeSearchText(
          extractImplementationText(reference),
        ),
        metadata: normalizeSearchText(metadata.metadataText).slice(
          0,
          MAX_ANNOTATION_TOTAL_TEXT_LENGTH,
        ),
      },
    });
  }

  return entries;
}

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "component",
  "for",
  "from",
  "i",
  "in",
  "into",
  "me",
  "my",
  "of",
  "on",
  "please",
  "that",
  "the",
  "to",
  "want",
  "with",
]);

/**
 * Drop filler words and de-duplicate query tokens. Natural-language searches
 * often include filler ("I want to upload a component to GCS"); removing those
 * prevents common tokens like "a"/"to" from matching nearly every component and
 * drowning out the useful intent terms.
 */
function uniqueTokens(tokens: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (QUERY_STOP_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
  }
  return unique;
}

function tokenizeQuery(text: string): {
  concepts: string[][];
  tokens: string[];
  requiredTokens: string[];
  phraseTokenSequences: string[][];
} {
  const rawTokens = splitIdentifierText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(isNonEmptyString);
  const positiveRawTokens = rawTokens.filter(
    (token) => !QUERY_STOP_WORDS.has(token),
  );
  const concepts: string[][] = [];
  const conceptTokens: string[] = [];
  const seenConcepts = new Set<string>();

  for (const token of rawTokens) {
    if (QUERY_STOP_WORDS.has(token)) continue;

    const variants = uniqueTokens(
      expandSynonymTokens([token, stemToken(token)]),
    );
    if (variants.length === 0) continue;

    const conceptKey = variants.join("\0");
    if (seenConcepts.has(conceptKey)) continue;

    concepts.push(variants);
    conceptTokens.push(...variants);
    seenConcepts.add(conceptKey);
  }

  return {
    concepts,
    tokens: uniqueTokens(conceptTokens),
    requiredTokens: uniqueTokens(positiveRawTokens.map(stemToken)),
    phraseTokenSequences: [
      positiveRawTokens,
      positiveRawTokens.map(stemToken),
    ].filter((sequence) => sequence.length > 1),
  };
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
  metadata: 1,
};

const FIELD_PHRASE_BONUS: Record<MatchField, number> = {
  name: 10,
  description: 4,
  io: 4,
  implementation: 2,
  metadata: 2,
};

const PREFIX_MATCH_BONUS_MULTIPLIER = 0.5;
const FUZZY_MATCH_BONUS_MULTIPLIER = 0.75;
const ALL_QUERY_TOKENS_BONUS = 6;

const SEARCH_FIELDS: MatchField[] = [
  "name",
  "description",
  "io",
  "implementation",
  "metadata",
];
const FUZZY_SEARCH_FIELDS: MatchField[] = ["name", "io"];

interface SearchOptions {
  /** Max results to return. Default 20. */
  limit?: number;
  /**
   * Minimum query length before any results are returned. Default 1. Set to 2
   * or 3 to suppress noisy results on the first keystroke.
   */
  minLength?: number;
}

function searchableTokens(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(isNonEmptyString);
}

function maxTypoDistance(field: MatchField, token: string): number {
  // Require length >= 5 before allowing any edits: 4-char tokens are too short
  // for distance-1 fuzziness without false positives on generic IO names
  // (data<->date, path<->bath, list<->last). Keep IO stricter than names:
  // generic interface words are more likely to produce surprising fuzzy hits.
  if (token.length < 5) return 0;
  if (field === "io") return 1;
  if (token.length < 7) return 1;
  return 2;
}

function isEditDistanceAtMost(
  left: string,
  right: string,
  maxDistance: number,
): boolean {
  if (maxDistance === 0) return left === right;
  if (Math.abs(left.length - right.length) > maxDistance) return false;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    let rowMinimum = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
      current[rightIndex] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maxDistance) return false;
    previous = current;
  }

  return previous[right.length] <= maxDistance;
}

function hasFuzzyTokenMatch(
  field: MatchField,
  fieldTokens: string[],
  token: string,
): boolean {
  const maxDistance = maxTypoDistance(field, token);
  if (maxDistance === 0) return false;
  return fieldTokens.some(
    (fieldToken) =>
      fieldToken[0] === token[0] &&
      Math.abs(fieldToken.length - token.length) <= maxDistance &&
      token !== fieldToken &&
      isEditDistanceAtMost(token, fieldToken, maxDistance),
  );
}

function entryMatchesToken(entry: IndexEntry, token: string): boolean {
  return SEARCH_FIELDS.some((field) => entry.searchable[field].includes(token));
}

function buildRareTokenWeights(
  index: IndexEntry[],
  tokens: string[],
): Map<string, number> {
  const documentFrequencies = new Map(tokens.map((token) => [token, 0]));

  for (const entry of index) {
    for (const token of tokens) {
      if (!entryMatchesToken(entry, token)) continue;
      documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1);
    }
  }

  const weights = new Map<string, number>();
  for (const [token, documentFrequency] of documentFrequencies) {
    const inverseFrequency = Math.log(
      (index.length + 1) / (documentFrequency + 1),
    );
    weights.set(token, 1 + inverseFrequency);
  }
  return weights;
}

/**
 * Score one entry against the tokenized query. Returns 0 if no field matched.
 *
 * Scoring model:
 * - Per query concept: each field that contains any token variant contributes
 *   its weight once.
 * - Word-boundary matches (a query token that begins an indexed token,
 *   including exact matches) get a small extra boost, useful for partial names.
 * - Rare query tokens count more than tokens that match many components.
 * - Contiguous multi-token phrase matches and all-token matches get bonuses.
 *
 * Indexed text and query text are normalized before scoring; raw scores are
 * only used for ordering.
 */
function scoreEntry(
  entry: IndexEntry,
  concepts: string[][],
  requiredTokens: string[],
  phraseTokenSequences: string[][],
  tokenWeights: Map<string, number>,
): { score: number; matchedFields: MatchField[] } {
  const matched = new Set<MatchField>();
  let score = 0;

  // A field's tokenization depends only on the field, not the query token, so
  // split it once per entry (cached) rather than re-splitting inside the
  // per-query-token loop — that re-split is hot on every keystroke.
  const fieldTokenCache = new Map<MatchField, string[]>();
  const fieldTokensFor = (field: MatchField): string[] => {
    const cached = fieldTokenCache.get(field);
    if (cached) return cached;
    const fieldTokens = searchableTokens(entry.searchable[field]);
    fieldTokenCache.set(field, fieldTokens);
    return fieldTokens;
  };

  for (const concept of concepts) {
    for (const field of SEARCH_FIELDS) {
      const fieldText = entry.searchable[field];
      const fieldWeight = FIELD_WEIGHTS[field];
      const matchingTokens = concept.filter((token) =>
        fieldText.includes(token),
      );

      if (matchingTokens.length > 0) {
        const tokenWeight = Math.max(
          ...matchingTokens.map((token) => tokenWeights.get(token) ?? 1),
        );
        score += fieldWeight * tokenWeight;
        matched.add(field);

        const hasPrefixMatch = matchingTokens.some((token) =>
          fieldTokensFor(field).some((fieldToken) =>
            fieldToken.startsWith(token),
          ),
        );
        if (hasPrefixMatch) {
          score += fieldWeight * PREFIX_MATCH_BONUS_MULTIPLIER * tokenWeight;
        }
        continue;
      }

      if (!FUZZY_SEARCH_FIELDS.includes(field)) continue;

      const literalToken = concept[0];
      const fuzzyTokens = hasFuzzyTokenMatch(
        field,
        fieldTokensFor(field),
        literalToken,
      )
        ? [literalToken]
        : [];
      if (fuzzyTokens.length === 0) continue;

      const tokenWeight = Math.max(
        ...fuzzyTokens.map((token) => tokenWeights.get(token) ?? 1),
      );
      score += fieldWeight * FUZZY_MATCH_BONUS_MULTIPLIER * tokenWeight;
      matched.add(field);
    }
  }

  if (phraseTokenSequences.length > 0) {
    for (const field of SEARCH_FIELDS) {
      const normalizedField = entry.searchable[field].replace(
        /[^a-z0-9]+/g,
        " ",
      );
      if (
        !phraseTokenSequences.some((sequence) =>
          normalizedField.includes(sequence.join(" ")),
        )
      ) {
        continue;
      }
      score += FIELD_PHRASE_BONUS[field];
      matched.add(field);
    }
  }

  if (
    requiredTokens.length > 1 &&
    requiredTokens.every((token) => entryMatchesToken(entry, token))
  ) {
    score += ALL_QUERY_TOKENS_BONUS;
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

  const { concepts, tokens, requiredTokens, phraseTokenSequences } =
    tokenizeQuery(trimmed);
  if (concepts.length === 0) return [];
  const tokenWeights = buildRareTokenWeights(index, tokens);

  const scored: Array<LexicalMatch & { score: number }> = [];
  for (const entry of index) {
    const { score, matchedFields } = scoreEntry(
      entry,
      concepts,
      requiredTokens,
      phraseTokenSequences,
      tokenWeights,
    );
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
