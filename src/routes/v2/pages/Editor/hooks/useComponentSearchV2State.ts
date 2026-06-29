import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";

import { listApiPublishedComponentsGet } from "@/api/sdk.gen";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
import { useNaturalLanguageComponentRerank } from "@/hooks/useNaturalLanguageComponentSearch";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchUserComponents,
  flattenFolders,
} from "@/providers/ComponentLibraryProvider/componentLibrary";
import { createLibraryObject } from "@/providers/ComponentLibraryProvider/libraries/factory";
import { ensureLibraryFactoriesRegistered } from "@/providers/ComponentLibraryProvider/libraries/setup";
import {
  LibraryDB,
  type StoredLibrary,
} from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  createSourceFilterOptions,
  filterIndexByDisabledSourceKeys,
} from "@/routes/Dashboard/DashboardComponentsV2SourceFilter";
import {
  buildAiCandidateMatches,
  buildLexicalMatches,
  buildRerankMatchByDigest,
  buildResultFolders,
  buildResults,
  buildSourcedHydratedReferences,
  collectAllSourcedReferences,
  type ComponentSearchV2State,
  LEXICAL_RESULT_LIMIT,
  registeredLibrariesFingerprint,
  registeredSource,
  rerankedMatches,
} from "@/routes/v2/pages/Editor/components/componentSearchV2Logic";
import { rankComponentMatchesByEmbeddings } from "@/services/componentSearchEmbeddings";
import {
  buildSearchIndex,
  type IndexEntry,
  type LexicalMatch,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import { buildComponentSearchSuggestions } from "@/services/componentSearchSuggestions";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import { componentReferenceToCandidate } from "@/services/naturalLanguageComponentSearchService";
import type { ComponentFolder } from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { HOURS } from "@/utils/constants";

function mergeUniqueMatches(
  primary: LexicalMatch[],
  secondary: LexicalMatch[],
  fallback: LexicalMatch[],
  limit: number,
): LexicalMatch[] {
  const merged: LexicalMatch[] = [];
  const seen = new Set<string>();
  for (const match of [...primary, ...secondary, ...fallback]) {
    if (seen.has(match.digest)) continue;
    seen.add(match.digest);
    merged.push(match);
    if (merged.length >= limit) return merged;
  }
  return merged;
}

export function useComponentSearchV2State(
  query: string,
): ComponentSearchV2State {
  const queryClient = useQueryClient();
  const { backendUrl, configured, available } = useBackend();
  const { config: aiConfig } = useAiProviderSettings();

  const { data: standardLibrary, isLoading: isLoadingStandardLibrary } =
    useQuery({
      queryKey: ["componentLibrary"],
      queryFn: fetchAndStoreComponentLibrary,
      staleTime: HOURS,
    });

  const { data: userFolder, isLoading: isLoadingUserComponents } = useQuery({
    queryKey: ["userComponents"],
    queryFn: fetchUserComponents,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: publishedRefs = [], isLoading: isLoadingPublished } = useQuery({
    queryKey: ["component-search-v2", "published", backendUrl],
    enabled: configured && available,
    staleTime: HOURS,
    queryFn: async (): Promise<ComponentReference[]> => {
      const result = await listApiPublishedComponentsGet({});
      if (result.response.status !== 200 || !result.data) return [];

      return (result.data.published_components ?? [])
        .filter((component) => !component.deprecated)
        .map((component) => ({
          digest: component.digest,
          name: component.name ?? undefined,
          url:
            component.url ?? `${backendUrl}/api/components/${component.digest}`,
          published_by: component.published_by,
        }));
    },
  });

  const registeredLibraries = useLiveQuery<StoredLibrary[]>(async () => {
    ensureLibraryFactoriesRegistered();
    return LibraryDB.component_libraries.toArray();
  }, []);

  const { data: registeredSourced = [], isLoading: isLoadingRegistered } =
    useQuery({
      queryKey: [
        "component-search-v2",
        "registered-libraries",
        registeredLibrariesFingerprint(registeredLibraries),
      ],
      enabled: registeredLibraries !== undefined,
      staleTime: HOURS,
      queryFn: async (): Promise<SourcedReference[]> => {
        if (!registeredLibraries || registeredLibraries.length === 0) return [];

        const results = await Promise.allSettled(
          registeredLibraries.map(async (library) => {
            const componentLibrary = createLibraryObject(library);
            const folder: ComponentFolder =
              await componentLibrary.getComponents({});
            return { library, folder };
          }),
        );

        const sourced: SourcedReference[] = [];
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const source = registeredSource(result.value.library);
          for (const reference of flattenFolders(result.value.folder)) {
            sourced.push({ reference, source });
          }
        }

        return sourced;
      },
    });

  const sourcedReferences = collectAllSourcedReferences({
    standardLibrary,
    publishedRefs,
    registeredSourced,
    userFolder,
  });

  const referencesFingerprint = sourcedReferences
    .map((item) => item.reference.digest ?? item.reference.url ?? "")
    .sort()
    .join("|");

  const { data: hydratedReferences = [], isLoading: isHydrating } = useQuery({
    queryKey: ["component-search-v2", "hydrate-library", referencesFingerprint],
    enabled: sourcedReferences.length > 0,
    staleTime: HOURS,
    queryFn: async (): Promise<HydratedComponentReference[]> => {
      const results = await Promise.all(
        sourcedReferences.map((item) =>
          queryClient
            .ensureQueryData({
              queryKey: [
                "component",
                "hydrate",
                getComponentQueryKey(item.reference),
              ],
              staleTime: HOURS,
              queryFn: () => hydrateComponentReference(item.reference),
            })
            .catch(() => null),
        ),
      );

      return results.filter(
        (reference): reference is HydratedComponentReference =>
          reference !== null,
      );
    },
  });

  const index = buildSearchIndex(
    buildSourcedHydratedReferences({
      sourcedReferences,
      hydratedReferences,
    }),
  );

  const [disabledSourceKeys, setDisabledSourceKeys] = useState<string[]>([]);
  const sourceFilterOptions = createSourceFilterOptions(index);
  const filteredIndex = filterIndexByDisabledSourceKeys(
    index,
    disabledSourceKeys,
  );

  const canUseEmbeddingSearch = aiConfig.apiBase.trim().length > 0;
  const trimmedQuery = query.trim();
  const lexicalMatches = buildLexicalMatches(filteredIndex, trimmedQuery);
  const aiCandidateMatches = buildAiCandidateMatches(
    filteredIndex,
    trimmedQuery,
  );
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
    rerankedFor === trimmedQuery &&
    rerankBaseMatches.length > 0 &&
    !isReranking &&
    !isEmbeddingSearchPending &&
    (rerankData?.matches.length ?? 0) > 0;

  const displayedMatches = (
    isRerankActive
      ? rerankedMatches(rerankData, rerankBaseMatches)
      : lexicalMatches
  ).slice(0, LEXICAL_RESULT_LIMIT);

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
        trimmedQuery,
        {
          apiBase: aiConfig.apiBase,
          apiKey: aiConfig.apiKey,
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
    if (!trimmedQuery || !isConfigured) return;

    const canUseEmbeddings = useEmbeddings && canUseEmbeddingSearch;
    if (matches.length === 0 && !canUseEmbeddings) return;

    const effectiveLimit = limit || LEXICAL_RESULT_LIMIT;
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
    setRerankedFor(trimmedQuery);
    mutate({ query: trimmedQuery, candidates, scoreAllCandidates });
  };

  const rerank = () => {
    void startRerank(aiCandidateMatches, {
      scoreAllCandidates: true,
      useEmbeddings: true,
      limit: aiCandidateMatches.length || LEXICAL_RESULT_LIMIT,
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
    browseFolders: buildResultFolders({
      results,
      standardLibrary: disabledSourceKeys.includes("standard")
        ? undefined
        : standardLibrary,
    }),
    searchSuggestions: buildComponentSearchSuggestions(filteredIndex, {
      includeSources: false,
      query: trimmedQuery,
    }),
    sourceFilterOptions,
    disabledSourceKeys,
    isLoading:
      isLoadingStandardLibrary ||
      isLoadingUserComponents ||
      isLoadingPublished ||
      registeredLibraries === undefined ||
      isLoadingRegistered ||
      isHydrating,
    canRerank:
      trimmedQuery.length > 0 &&
      (aiCandidateMatches.length > 0 || canUseEmbeddingSearch) &&
      isConfigured,
    isReranking: isReranking || isEmbeddingSearchPending,
    isRerankActive,
    rerank,
    clearRerank,
    toggleSourceFilter,
    enableAllSources,
  };
}
