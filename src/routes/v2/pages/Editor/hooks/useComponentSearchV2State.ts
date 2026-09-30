import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";

import { listApiPublishedComponentsGet } from "@/api/sdk.gen";
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
  buildLexicalMatches,
  buildRerankMatchByDigest,
  buildResultFolders,
  buildResults,
  collectAllSourcedReferences,
  type ComponentSearchV2State,
  mergeSearchIndexes,
  registeredLibrariesFingerprint,
  registeredSource,
  rerankedMatches,
} from "@/routes/v2/pages/Editor/components/componentSearchV2Logic";
import { buildComponentRerankMatches } from "@/services/componentRerankService";
import {
  buildSearchIndex,
  type IndexEntry,
  type LexicalMatch,
  mergeUniqueMatches,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import { buildComponentSearchSuggestions } from "@/services/componentSearchSuggestions";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import { componentReferenceToCandidate } from "@/services/naturalLanguageComponentSearchService";
import type { ComponentFolder } from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";
import { HOURS } from "@/utils/constants";

export function useComponentSearchV2State(
  query: string,
  { pauseSearch = false }: { pauseSearch?: boolean } = {},
): ComponentSearchV2State {
  const queryClient = useQueryClient();
  const { backendUrl, configured, available } = useBackend();

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
    .map(
      (item) =>
        `${item.source.kind}:${item.source.id}:${item.source.label}:${item.reference.digest ?? item.reference.url ?? ""}`,
    )
    .sort()
    .join("|");

  const trimmedQuery = query.trim();
  const searchableQuery = pauseSearch ? "" : trimmedQuery;

  const { data: hydratedIndex = [], isFetching: isHydrating } = useQuery({
    queryKey: ["component-search-v2", "search-index", referencesFingerprint],
    enabled: sourcedReferences.length > 0 && searchableQuery.length > 0,
    staleTime: HOURS,
    queryFn: async (): Promise<IndexEntry[]> => {
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
            .then((reference) => ({ reference, source: item.source }))
            .catch(() => null),
        ),
      );

      const hydratedSourced: SourcedReference[] = [];
      for (const item of results) {
        if (!item?.reference) continue;
        hydratedSourced.push({
          reference: item.reference,
          source: item.source,
        });
      }

      return buildSearchIndex(hydratedSourced);
    },
  });

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

  const lexicalMatches = pauseSearch
    ? []
    : buildLexicalMatches(filteredIndex, searchableQuery);
  const {
    mutate,
    reset: resetRerank,
    cancel: cancelRerank,
    progress: rerankProgress,
    data: rerankData,
    isPending: isReranking,
    isConfigured,
    error: rerankError,
    modelLabel: rerankModelLabel,
  } = useNaturalLanguageComponentRerank(
    JSON.stringify([
      query,
      pauseSearch,
      disabledSourceKeys,
      referencesFingerprint,
    ]),
  );
  const [rerankedFor, setRerankedFor] = useState<string | null>(null);
  const [rerankBaseMatches, setRerankBaseMatches] = useState<LexicalMatch[]>(
    [],
  );

  const clearRerank = () => {
    cancelRerank();
    setRerankedFor(null);
    setRerankBaseMatches([]);
  };

  useEffect(() => {
    resetRerank();
    setRerankedFor(null);
    setRerankBaseMatches([]);
  }, [query, disabledSourceKeys, resetRerank]);

  const isRerankActive =
    rerankedFor === searchableQuery &&
    rerankBaseMatches.length > 0 &&
    !isReranking &&
    (rerankData?.matches.length ?? 0) > 0;

  const displayedMatches = isRerankActive
    ? mergeUniqueMatches(
        rerankedMatches(rerankData, rerankBaseMatches),
        [],
        lexicalMatches,
        rerankBaseMatches.length + lexicalMatches.length,
      )
    : lexicalMatches;

  const aiCandidateMatches = buildComponentRerankMatches(
    filteredIndex,
    searchableQuery,
  );
  const isLoading =
    isLoadingStandardLibrary ||
    isLoadingUserComponents ||
    isLoadingPublished ||
    registeredLibraries === undefined ||
    isLoadingRegistered;
  const canRerank =
    !pauseSearch &&
    !isLoading &&
    !isHydrating &&
    searchableQuery.length > 0 &&
    aiCandidateMatches.length > 0 &&
    isConfigured;

  const rerank = () => {
    if (!canRerank || isReranking) return;
    const candidates = aiCandidateMatches
      .map((match) =>
        componentReferenceToCandidate(match.reference, match.source),
      )
      .filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== null,
      );
    if (!candidates.length) return;
    setRerankBaseMatches(aiCandidateMatches);
    setRerankedFor(searchableQuery);
    mutate({ query: searchableQuery, candidates, scoreAllCandidates: true });
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
    canRerank,
    isReranking,
    rerankProgress,
    isRerankActive,
    rerankError: rerankError?.message,
    rerankModelLabel,
    rerank,
    clearRerank,
    toggleSourceFilter,
    enableAllSources,
  };
}
