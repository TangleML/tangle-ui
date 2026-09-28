import {
  type IndexEntry,
  indexEntryToLexicalMatch,
  lexicalSearch,
  mergeUniqueMatches,
} from "@/services/componentSearchIndex";
import { rerankComponentsWithJev } from "@/services/jevComponentRerankService";
import {
  componentReferenceToCandidate,
  type RerankCandidate,
  rerankComponentsByNaturalLanguage,
  type RerankProgress,
} from "@/services/naturalLanguageComponentSearchService";
import type { ComponentRerankConfig } from "@/types/aiProvider";

export function buildComponentRerankMatches(
  index: IndexEntry[],
  query: string,
) {
  if (!query.trim()) return [];
  const loaded = index.filter((entry) =>
    componentReferenceToCandidate(entry.reference, entry.source),
  );
  return mergeUniqueMatches(
    lexicalSearch(loaded, query, { limit: loaded.length }),
    [],
    loaded.map(indexEntryToLexicalMatch),
    loaded.length,
  );
}

export function rerankComponents(
  query: string,
  candidates: RerankCandidate[],
  options: ComponentRerankConfig & {
    signal?: AbortSignal;
    onProgress?: (progress: RerankProgress) => void;
  },
  settings: { scoreAllCandidates?: boolean } = {},
) {
  return options.provider === "jev"
    ? rerankComponentsWithJev(query, candidates, options)
    : rerankComponentsByNaturalLanguage(query, candidates, options, settings);
}
