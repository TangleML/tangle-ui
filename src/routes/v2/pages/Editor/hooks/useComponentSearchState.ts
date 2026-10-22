import { useEffect, useRef, useState } from "react";

import {
  createSourceFilterOptions,
  filterIndexByDisabledSourceKeys,
} from "@/components/shared/ComponentSearchSourceFilter";
import { supportsAiEmbeddings } from "@/config/aiConfig";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useComponentSearchCatalog } from "@/hooks/useComponentSearchCatalog";
import { useNaturalLanguageComponentRerank } from "@/hooks/useNaturalLanguageComponentSearch";
import { rankComponentMatchesByEmbeddings } from "@/services/componentSearchEmbeddings";
import {
  buildSearchIndex,
  type IndexEntry,
  type LexicalMatch,
  mergeUniqueMatches,
} from "@/services/componentSearchIndex";
import {
  buildAiCandidateMatches,
  buildLexicalMatches,
  buildRerankMatchByDigest,
  buildResultFolders,
  buildResults,
  type ComponentSearchState,
  mergeSearchIndexes,
  rerankedMatches,
} from "@/services/componentSearchLogic";
import { buildComponentSearchSuggestions } from "@/services/componentSearchSuggestions";
import { componentReferenceToCandidate } from "@/services/naturalLanguageComponentSearchService";

const AI_EMBEDDING_FALLBACK_LIMIT = 20;

export function useComponentSearchState(
  query: string,
  { pauseSearch = false }: { pauseSearch?: boolean } = {},
): ComponentSearchState {
  const { config: aiConfig } = useAiProviderSettings();
  const trimmedQuery = query.trim();
  const searchableQuery = pauseSearch ? "" : trimmedQuery;
  const {
    standardLibrary,
    references: sourcedReferences,
    index: hydratedIndex,
    isLoading,
  } = useComponentSearchCatalog(searchableQuery.length > 0);

  const index = mergeSearchIndexes(
    buildSearchIndex(sourcedReferences, { includeNameOnly: true }),
    hydratedIndex,
  );

  const [disabledSourceKeys, setDisabledSourceKeys] = useState<string[]>([]);
  const sourceFilterOptions = createSourceFilterOptions(sourcedReferences);
  const filteredIndex = filterIndexByDisabledSourceKeys(
    index,
    disabledSourceKeys,
  );
  const disabled = new Set(disabledSourceKeys);
  const browseSourcedReferences = sourcedReferences.filter(
    (item) => !disabled.has(item.source.kind),
  );

  const canUseEmbeddingSearch = supportsAiEmbeddings(aiConfig.apiBase);
  const lexicalMatches = pauseSearch
    ? []
    : buildLexicalMatches(filteredIndex, searchableQuery);
  const {
    mutate,
    reset: resetRerank,
    data: rerankData,
    isPending: isReranking,
    isConfigured,
  } = useNaturalLanguageComponentRerank();
  const [rerankedFor, setRerankedFor] = useState<string | null>(null);
  const [rerankBaseMatches, setRerankBaseMatches] = useState<LexicalMatch[]>(
    [],
  );
  const [isEmbeddingSearchPending, setIsEmbeddingSearchPending] =
    useState(false);
  const embeddingAbortControllerRef = useRef<AbortController | null>(null);

  const clearRerank = () => {
    resetRerank();
    setRerankedFor(null);
    setRerankBaseMatches([]);
  };

  useEffect(() => {
    resetRerank();
    setRerankedFor(null);
    setRerankBaseMatches([]);
    embeddingAbortControllerRef.current?.abort();
  }, [query, disabledSourceKeys, resetRerank]);

  useEffect(() => {
    return () => embeddingAbortControllerRef.current?.abort();
  }, []);

  const isRerankActive =
    rerankedFor === searchableQuery &&
    rerankBaseMatches.length > 0 &&
    !isReranking &&
    !isEmbeddingSearchPending &&
    (rerankData?.matches.length ?? 0) > 0;

  const displayedMatches = isRerankActive
    ? mergeUniqueMatches(
        rerankedMatches(rerankData, rerankBaseMatches),
        [],
        lexicalMatches,
        rerankBaseMatches.length + lexicalMatches.length,
      )
    : lexicalMatches;

  const buildEmbeddingMatches = async ({
    sourceIndex,
    limit,
  }: {
    sourceIndex: IndexEntry[];
    limit: number;
  }): Promise<LexicalMatch[]> => {
    if (!canUseEmbeddingSearch) return [];
    embeddingAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    embeddingAbortControllerRef.current = abortController;
    setIsEmbeddingSearchPending(true);
    try {
      return await rankComponentMatchesByEmbeddings(
        sourceIndex,
        searchableQuery,
        {
          ...aiConfig,
          signal: abortController.signal,
        },
        { limit },
      );
    } catch {
      return [];
    } finally {
      if (embeddingAbortControllerRef.current === abortController) {
        embeddingAbortControllerRef.current = null;
        setIsEmbeddingSearchPending(false);
      }
    }
  };

  const startRerank = async (
    matches: LexicalMatch[],
    {
      scoreAllCandidates,
      useEmbeddings,
      limit,
    }: {
      scoreAllCandidates: boolean;
      useEmbeddings: boolean;
      limit: number;
    },
  ) => {
    if (!searchableQuery || !isConfigured) return;

    const canUseEmbeddings = useEmbeddings && canUseEmbeddingSearch;
    if (matches.length === 0 && !canUseEmbeddings) return;

    const effectiveLimit = limit || AI_EMBEDDING_FALLBACK_LIMIT;
    const embeddingMatches = canUseEmbeddings
      ? await buildEmbeddingMatches({
          sourceIndex: filteredIndex,
          limit: effectiveLimit,
        })
      : [];
    const lexicalMatchesToKeep = useEmbeddings
      ? matches.slice(0, Math.min(60, effectiveLimit))
      : matches;
    const rerankMatches = mergeUniqueMatches(
      lexicalMatchesToKeep,
      embeddingMatches,
      matches,
      effectiveLimit,
    );

    const candidates = rerankMatches
      .map((match) =>
        componentReferenceToCandidate(match.reference, match.source),
      )
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      );

    if (candidates.length === 0) return;

    resetRerank();
    setRerankBaseMatches(rerankMatches);
    setRerankedFor(searchableQuery);
    mutate({ query: searchableQuery, candidates, scoreAllCandidates });
  };

  const rerank = () => {
    const aiCandidateMatches = buildAiCandidateMatches(
      filteredIndex,
      searchableQuery,
    );
    void startRerank(aiCandidateMatches, {
      scoreAllCandidates: true,
      useEmbeddings: true,
      limit: aiCandidateMatches.length || AI_EMBEDDING_FALLBACK_LIMIT,
    });
  };

  const toggleSourceFilter = (sourceKey: string) => {
    setDisabledSourceKeys((current) =>
      current.includes(sourceKey)
        ? current.filter((key) => key !== sourceKey)
        : [...current, sourceKey],
    );
  };

  const enableAllSources = () => setDisabledSourceKeys([]);

  const rerankMatchByDigest = buildRerankMatchByDigest(
    rerankData,
    isRerankActive,
  );
  const results = buildResults(
    displayedMatches,
    rerankMatchByDigest,
    isRerankActive,
  );

  return {
    results,
    browseFolders: pauseSearch
      ? []
      : buildResultFolders({
          results: browseSourcedReferences,
          standardLibrary: disabledSourceKeys.includes("standard")
            ? undefined
            : standardLibrary,
        }),
    searchSuggestions:
      !pauseSearch && results.length === 0
        ? buildComponentSearchSuggestions(filteredIndex, {
            includeSources: false,
            query: searchableQuery,
          })
        : [],
    sourceFilterOptions,
    disabledSourceKeys,
    isLoading,
    canRerank:
      !pauseSearch &&
      searchableQuery.length > 0 &&
      (lexicalMatches.length > 0 || canUseEmbeddingSearch) &&
      isConfigured,
    isReranking: isReranking || isEmbeddingSearchPending,
    isRerankActive,
    rerank,
    clearRerank,
    toggleSourceFilter,
    enableAllSources,
  };
}
