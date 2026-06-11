/**
 * Pure, framework-free logic for the editor's component search panel.
 *
 * Everything here is deliberately React-free so it can be unit-tested in
 * isolation: source collection + dedup, hydrated-reference mapping, the lexical
 * candidate selection, the rerank merge, and the relevance-badge gating. The
 * React glue lives in `useComponentSearchV2State` and the panel components.
 */
import { flattenFolders } from "@/providers/ComponentLibraryProvider/componentLibrary";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  type ComponentSearchSource,
  type IndexEntry,
  indexEntryToLexicalMatch,
  type LexicalMatch,
  lexicalSearch,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import type { RerankResult } from "@/services/naturalLanguageComponentSearchService";
import type {
  ComponentFolder,
  ComponentLibrary,
  UIComponentFolder,
} from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";

/** How many lexical hits to display before the user asks for AI judgment. */
const LEXICAL_RESULT_LIMIT = 50;
/** Bounded candidate pool sent to AI rerank on click. */
const AI_CANDIDATE_LIMIT = 25;
// Scores at or below this are treated as the model excluding a candidate: such
// items keep their place in the list but are not badged as relevance matches.
const RERANK_EXCLUSION_THRESHOLD = 0.01;

const STANDARD_SOURCE: ComponentSearchSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};

export const PUBLISHED_SOURCE: ComponentSearchSource = {
  kind: "published",
  label: "Published",
  id: "published",
};

export const USER_SOURCE: ComponentSearchSource = {
  kind: "user",
  label: "User",
  id: "user",
};

export interface UserFolder {
  components?: ComponentReference[];
}

export interface ComponentSearchV2Result {
  reference: ComponentReference;
  source: ComponentSearchSource;
  rerankScore?: number;
}

export interface ComponentSearchV2State {
  results: ComponentSearchV2Result[];
  browseFolders: UIComponentFolder[];
  isLoading: boolean;
  canRerank: boolean;
  isReranking: boolean;
  rerank: () => void;
}

export function registeredSource(
  library: StoredLibrary,
): ComponentSearchSource {
  return { kind: "registered", label: library.name, id: library.id };
}

export function registeredLibrariesFingerprint(
  libraries: StoredLibrary[] | undefined,
): string {
  if (!libraries) return "loading";

  return JSON.stringify(
    libraries
      .map((library) => ({
        id: library.id,
        name: library.name,
        type: library.type,
        knownDigests: [...library.knownDigests].sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function collectAllSourcedReferences({
  standardLibrary,
  publishedRefs,
  registeredSourced,
  userFolder,
}: {
  standardLibrary: ComponentLibrary | undefined;
  publishedRefs: ComponentReference[];
  registeredSourced: SourcedReference[];
  userFolder: UserFolder | undefined;
}): SourcedReference[] {
  const all: SourcedReference[] = [];

  if (standardLibrary) {
    for (const reference of flattenFolders(standardLibrary)) {
      all.push({ reference, source: STANDARD_SOURCE });
    }
  }

  for (const reference of publishedRefs) {
    all.push({ reference, source: PUBLISHED_SOURCE });
  }

  all.push(...registeredSourced);

  for (const reference of userFolder?.components ?? []) {
    all.push({ reference, source: USER_SOURCE });
  }

  const seen = new Set<string>();
  const deduped: SourcedReference[] = [];
  for (const item of all) {
    const digest = item.reference.digest;
    if (!digest || seen.has(digest)) continue;
    seen.add(digest);
    deduped.push(item);
  }

  return deduped;
}

export function buildSourcedHydratedReferences({
  sourcedReferences,
  hydratedReferences,
}: {
  sourcedReferences: SourcedReference[];
  hydratedReferences: HydratedComponentReference[];
}): SourcedReference[] {
  const sourceByDigest = new Map<string, ComponentSearchSource>();
  for (const item of sourcedReferences) {
    if (item.reference.digest) {
      sourceByDigest.set(item.reference.digest, item.source);
    }
  }

  const sourcedHydrated: SourcedReference[] = [];
  for (const reference of hydratedReferences) {
    const source = sourceByDigest.get(reference.digest);
    if (source) sourcedHydrated.push({ reference, source });
  }

  return sourcedHydrated;
}

/**
 * Reorder lexical matches to follow the model's ranking. Candidates the model
 * scored at or below the exclusion threshold are pushed to the bottom, and any
 * lexical match the model did not rank is kept (after the ranked set, before
 * the excluded ones).
 */
export function rerankedMatches(
  rerankData: RerankResult | undefined,
  baseMatches: LexicalMatch[],
): LexicalMatch[] {
  if (!rerankData || rerankData.matches.length === 0) return baseMatches;

  const baseByDigest = new Map(
    baseMatches.map((match) => [match.digest, match]),
  );
  const ordered: LexicalMatch[] = [];
  const excluded: LexicalMatch[] = [];

  for (const match of rerankData.matches) {
    const baseMatch = baseByDigest.get(match.id);
    if (!baseMatch) continue;
    if (match.score <= RERANK_EXCLUSION_THRESHOLD) {
      excluded.push(baseMatch);
    } else {
      ordered.push(baseMatch);
    }
    baseByDigest.delete(match.id);
  }

  ordered.push(...baseByDigest.values(), ...excluded);
  return ordered;
}

function resultFolderName(result: ComponentSearchV2Result): string {
  switch (result.source.kind) {
    case "user":
      return "User Components";
    case "published":
      return "Published Components";
    case "registered":
      return result.source.label;
    case "standard":
      return "Standard library";
  }
}

function toUIFolder(folder: ComponentFolder): UIComponentFolder {
  return {
    name: folder.name,
    components: folder.components,
    folders: folder.folders?.map(toUIFolder),
    isUserFolder: folder.isUserFolder,
  };
}

export function buildResultFolders({
  results,
  standardLibrary,
}: {
  results: ComponentSearchV2Result[];
  standardLibrary: ComponentLibrary | undefined;
}): UIComponentFolder[] {
  const user: ComponentReference[] = [];
  const published: ComponentReference[] = [];
  const connectedByName = new Map<string, ComponentReference[]>();

  for (const result of results) {
    const name = resultFolderName(result);
    if (result.source.kind === "user") {
      user.push(result.reference);
    } else if (result.source.kind === "published") {
      published.push(result.reference);
    } else if (result.source.kind === "registered") {
      connectedByName.set(name, [
        ...(connectedByName.get(name) ?? []),
        result.reference,
      ]);
    }
  }

  const folders: UIComponentFolder[] = [];
  if (user.length > 0)
    folders.push({ name: "User Components", components: user });
  if (published.length > 0)
    folders.push({ name: "Published Components", components: published });
  if (standardLibrary) {
    folders.push({
      name: "Standard library",
      folders: standardLibrary.folders.map(toUIFolder),
    });
  }

  const connectedFolders = [...connectedByName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, components]) => ({ name, components }));
  if (connectedFolders.length > 0) {
    folders.push({ name: "Connected libraries", folders: connectedFolders });
  }

  return folders;
}

/**
 * Matches to display: an alphabetical browse list for an empty query, otherwise
 * the top lexical hits.
 */
export function buildLexicalMatches(
  index: IndexEntry[],
  trimmedQuery: string,
): LexicalMatch[] {
  if (trimmedQuery.length === 0) {
    return [...index]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(indexEntryToLexicalMatch);
  }
  return lexicalSearch(index, trimmedQuery, {
    limit: LEXICAL_RESULT_LIMIT,
    minLength: 1,
  });
}

/**
 * Bounded candidate pool for AI rerank. Prefers broad lexical hits; when
 * literal matching finds nothing it falls back to an alphabetical browse slice
 * so natural-language queries stay useful.
 */
export function buildAiCandidateMatches(
  index: IndexEntry[],
  trimmedQuery: string,
): LexicalMatch[] {
  if (trimmedQuery.length === 0) return [];

  const broadMatches = lexicalSearch(index, trimmedQuery, {
    limit: AI_CANDIDATE_LIMIT,
    minLength: 1,
  });
  if (broadMatches.length > 0) return broadMatches;

  return [...index]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, AI_CANDIDATE_LIMIT)
    .map(indexEntryToLexicalMatch);
}

export function buildRerankScoreByDigest(
  rerankData: RerankResult | undefined,
  isRerankActive: boolean,
): Map<string, number> {
  return new Map(
    isRerankActive
      ? (rerankData?.matches.map((match) => [match.id, match.score] as const) ??
          [])
      : [],
  );
}

/**
 * Attach a relevance badge only to items the model actually scored above the
 * exclusion threshold. Lexical results carried along after the ranked set, and
 * candidates the model excluded, render without a (misleading) badge.
 */
export function buildResults(
  displayedMatches: LexicalMatch[],
  rerankScoreByDigest: Map<string, number>,
  isRerankActive: boolean,
): ComponentSearchV2Result[] {
  return displayedMatches.map((match) => {
    const rerankScore = isRerankActive
      ? rerankScoreByDigest.get(match.digest)
      : undefined;
    return {
      reference: match.reference,
      source: match.source,
      ...(rerankScore !== undefined && rerankScore > RERANK_EXCLUSION_THRESHOLD
        ? { rerankScore }
        : {}),
    };
  });
}
