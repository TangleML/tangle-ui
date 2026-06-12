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
  buildAiCandidateMatches,
  buildLexicalMatches,
  buildRerankScoreByDigest,
  buildResultFolders,
  buildResults,
  buildSourcedHydratedReferences,
  collectAllSourcedReferences,
  type ComponentSearchV2State,
  registeredLibrariesFingerprint,
  registeredSource,
  rerankedMatches,
} from "@/routes/v2/pages/Editor/components/componentSearchV2Logic";
import {
  buildSearchIndex,
  type LexicalMatch,
  type SourcedReference,
} from "@/services/componentSearchIndex";
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

export function useComponentSearchV2State(
  query: string,
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

  const trimmedQuery = query.trim();
  const lexicalMatches = buildLexicalMatches(index, trimmedQuery);
  const aiCandidateMatches = buildAiCandidateMatches(index, trimmedQuery);

  const {
    mutate,
    data: rerankData,
    isPending: isReranking,
    isConfigured,
  } = useNaturalLanguageComponentRerank();
  const [rerankedFor, setRerankedFor] = useState<string | null>(null);
  const [rerankBaseMatches, setRerankBaseMatches] = useState<LexicalMatch[]>(
    [],
  );

  useEffect(() => {
    setRerankedFor(null);
    setRerankBaseMatches([]);
  }, [query]);

  const isRerankActive =
    rerankedFor === trimmedQuery &&
    rerankBaseMatches.length > 0 &&
    !isReranking &&
    rerankData !== undefined;

  const displayedMatches = isRerankActive
    ? rerankedMatches(rerankData, rerankBaseMatches)
    : lexicalMatches;

  const rerank = () => {
    if (!trimmedQuery || aiCandidateMatches.length === 0 || !isConfigured) {
      return;
    }

    const candidates = aiCandidateMatches
      .map((match) => componentReferenceToCandidate(match.reference))
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      );

    if (candidates.length === 0) return;

    setRerankBaseMatches(
      lexicalMatches.length > 0 ? lexicalMatches : aiCandidateMatches,
    );
    setRerankedFor(trimmedQuery);
    // Score every candidate so each displayed result shows a relevance %.
    mutate({ query: trimmedQuery, candidates, scoreAllCandidates: true });
  };

  const rerankScoreByDigest = buildRerankScoreByDigest(
    rerankData,
    isRerankActive,
  );
  const results = buildResults(
    displayedMatches,
    rerankScoreByDigest,
    isRerankActive,
  );

  return {
    results,
    browseFolders: buildResultFolders({ results, standardLibrary }),
    isLoading:
      isLoadingStandardLibrary ||
      isLoadingUserComponents ||
      isLoadingPublished ||
      registeredLibraries === undefined ||
      isLoadingRegistered ||
      isHydrating,
    canRerank:
      trimmedQuery.length > 0 && aiCandidateMatches.length > 0 && isConfigured,
    isReranking,
    rerank,
  };
}
