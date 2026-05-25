import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useDeferredValue, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
import { useNaturalLanguageComponentRerank } from "@/hooks/useNaturalLanguageComponentSearch";
import {
  fetchUserComponents,
  filterToUniqueByDigest,
  flattenFolders,
} from "@/providers/ComponentLibraryProvider/componentLibrary";
import {
  buildSearchIndex,
  type IndexEntry,
  type LexicalMatch,
  lexicalSearch,
  type MatchField,
} from "@/services/componentSearchIndex";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import {
  componentReferenceToCandidate,
  NaturalLanguageSearchConfigError,
  type RerankedMatch,
} from "@/services/naturalLanguageComponentSearchService";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { HOURS } from "@/utils/constants";
import { getComponentName } from "@/utils/getComponentName";

import { APP_ROUTES } from "../router";

// Repeated Tailwind combos extracted as named constants.
const PANEL_CLASS = "p-3 rounded-lg bg-card border border-border";
const PAGE_CLASS = "max-w-7xl";

/** How many lexical hits to display (and to feed into rerank). */
const LEXICAL_RESULT_LIMIT = 20;

const MATCH_FIELD_LABEL: Record<MatchField, string> = {
  name: "name",
  description: "description",
  io: "inputs/outputs",
  implementation: "command",
};

type ComponentLibraryFolder = Parameters<typeof flattenFolders>[0];
type UserFolder = { components?: ComponentReference[] };

interface ComponentCardProps {
  reference: ComponentReference;
  matchedFields?: MatchField[];
  reason?: string;
}

const ComponentCard = ({
  reference,
  matchedFields,
  reason,
}: ComponentCardProps) => {
  const name = getComponentName(reference);
  const description = reference.spec?.description;
  const publishedBy = reference.published_by;

  return (
    <BlockStack gap="2" className={PANEL_CLASS}>
      <InlineStack gap="2" blockAlign="center" wrap="wrap">
        <Icon name="Package" size="sm" />
        <Text size="sm" weight="semibold">
          {name}
        </Text>
        {matchedFields?.map((field) => (
          <Badge key={field} variant="secondary">
            matched: {MATCH_FIELD_LABEL[field]}
          </Badge>
        ))}
      </InlineStack>
      {publishedBy && (
        <Text size="xs" tone="subdued">
          by {publishedBy}
        </Text>
      )}
      {description && <Paragraph size="sm">{description}</Paragraph>}
      {reason && (
        <Paragraph size="xs" tone="subdued">
          Why: {reason}
        </Paragraph>
      )}
    </BlockStack>
  );
};

/**
 * Build the flat, deduped list of unhydrated component references from the
 * two library sources. Hydration happens separately because the static YAML
 * library returns refs with only `url` and `digest` set — we need to fetch
 * each YAML to get name/description/inputs/outputs.
 */
function collectRawReferences(
  componentLibrary: ComponentLibraryFolder | undefined,
  userFolder: UserFolder | undefined,
): ComponentReference[] {
  const standard = componentLibrary ? flattenFolders(componentLibrary) : [];
  const user = userFolder?.components ?? [];
  return filterToUniqueByDigest([...standard, ...user]);
}

export const DashboardComponentsV2View = () => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  // Deferred query lets the input stay snappy while the (cheap) lexical
  // search runs against the deferred value. React 19 native — no debounce
  // library, no useEffect timers.
  const deferredQuery = useDeferredValue(query);

  const { data: componentLibrary, isLoading: libraryLoading } = useQuery({
    queryKey: ["componentLibrary"],
    queryFn: fetchAndStoreComponentLibrary,
    staleTime: HOURS,
  });

  const { data: userFolder, isLoading: userLoading } = useQuery({
    queryKey: ["userComponents"],
    queryFn: fetchUserComponents,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const rawReferences = collectRawReferences(componentLibrary, userFolder);
  // Fingerprint of which refs are in play. Changes when the library set
  // changes, so the hydration cache invalidates appropriately.
  const referencesFingerprint = rawReferences
    .map((r) => r.digest ?? r.url ?? "")
    .sort()
    .join("|");

  // Use `isLoading` (first fetch only), not `isFetching` (any fetch). A
  // background refetch shouldn't flip the page back to a skeleton state.
  const { data: hydratedReferences, isLoading: hydrating } = useQuery({
    queryKey: ["component-search-v2", "hydrate-library", referencesFingerprint],
    enabled: rawReferences.length > 0,
    staleTime: HOURS,
    queryFn: async () => {
      const results = await Promise.all(
        rawReferences.map((ref) =>
          // Reuse the same cache key as useHydrateComponentReference so
          // individual component cards elsewhere in the app share hydration.
          queryClient
            .ensureQueryData({
              queryKey: ["component", "hydrate", getComponentQueryKey(ref)],
              staleTime: HOURS,
              queryFn: () => hydrateComponentReference(ref),
            })
            .catch(() => null),
        ),
      );
      return results.filter((r): r is HydratedComponentReference => r !== null);
    },
  });

  // The search index is a pure derivation from hydrated refs. React
  // Compiler will memoize this; `hydratedReferences` is a stable reference
  // from React Query when nothing has changed.
  const index: IndexEntry[] = buildSearchIndex(hydratedReferences ?? []);
  const total = index.length;

  // Alphabetical order for the browse-all view. Predictable scrolling beats
  // "whatever order the library happened to load in."
  const sortedIndex = [...index].sort((a, b) => a.name.localeCompare(b.name));

  const lexicalMatches: LexicalMatch[] = lexicalSearch(index, deferredQuery, {
    limit: LEXICAL_RESULT_LIMIT,
  });

  const {
    mutate: rerank,
    data: rerankData,
    isPending: isReranking,
    error: rerankError,
    reset: resetRerank,
    isConfigured,
  } = useNaturalLanguageComponentRerank();

  // Reranked results are tied to the exact query that triggered them. If the
  // user types more, we drop the rerank rather than show results for an old
  // query. Tracked here so we can clear on input change.
  const [rerankedFor, setRerankedFor] = useState<string | null>(null);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    // Any edit invalidates the rerank. Cheaper to drop it than to think
    // about staleness.
    if (rerankedFor !== null) {
      setRerankedFor(null);
      resetRerank();
    }
  };

  const handleSmartSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length === 0 || lexicalMatches.length === 0) return;

    const candidates = lexicalMatches
      .map((m) => componentReferenceToCandidate(m.reference))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (candidates.length === 0) return;

    setRerankedFor(trimmed);
    rerank({ query: trimmed, candidates });
  };

  const isLoadingLibrary = libraryLoading || userLoading || hydrating;
  const noLibraryData = !isLoadingLibrary && total === 0;
  const trimmedQuery = query.trim();
  const isEmpty = trimmedQuery.length === 0;
  const isConfigError = rerankError instanceof NaturalLanguageSearchConfigError;
  const rerankActive =
    rerankedFor !== null &&
    rerankedFor === trimmedQuery &&
    rerankData !== undefined &&
    !isReranking;

  // What we actually render. Rerank wins when active; otherwise lexical.
  const displayedResults = rerankActive
    ? mergeRerankIntoLexical(rerankData.matches, lexicalMatches)
    : lexicalMatches.map((m) => ({ ...m, reason: undefined }));

  return (
    <BlockStack gap="4" className={PAGE_CLASS}>
      <BlockStack gap="1">
        <Heading level={2}>Components V2</Heading>
        <Paragraph size="sm" tone="subdued">
          Type to search your component library. Results match on name,
          description, inputs/outputs, and container command. Use AI search to
          rerank with an LLM when literal matching isn&apos;t enough.
        </Paragraph>
      </BlockStack>

      <InlineStack gap="3" blockAlign="center" wrap="nowrap">
        <Input
          type="search"
          placeholder="e.g. train_test_split, pandas, clean up my data"
          value={query}
          onChange={handleQueryChange}
          aria-label="Search components"
          disabled={isLoadingLibrary || noLibraryData}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="icon"
          onClick={handleSmartSearch}
          disabled={
            isReranking ||
            isEmpty ||
            lexicalMatches.length === 0 ||
            !isConfigured
          }
          aria-label={isReranking ? "AI search in progress" : "AI search"}
          title="AI search — rerank these results with an LLM"
        >
          {isReranking ? <Spinner size={16} /> : <Icon name="Sparkles" />}
        </Button>
      </InlineStack>

      {isLoadingLibrary && (
        <BlockStack gap="2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </BlockStack>
      )}

      {noLibraryData && (
        <Paragraph size="sm" tone="subdued">
          No components found in your library.
        </Paragraph>
      )}

      {!isLoadingLibrary && isEmpty && !noLibraryData && (
        <BlockStack gap="2">
          <Paragraph size="xs" tone="subdued">
            {total} components in your library. Start typing to search.
          </Paragraph>
          {sortedIndex.map((entry) => (
            <ComponentCard key={entry.digest} reference={entry.reference} />
          ))}
        </BlockStack>
      )}

      {!isEmpty && lexicalMatches.length === 0 && !isLoadingLibrary && (
        <Paragraph size="sm" tone="subdued">
          No components matched “{trimmedQuery}”. Try different terms or check
          for typos.
        </Paragraph>
      )}

      {!isConfigured && !isEmpty && lexicalMatches.length > 0 && (
        <BlockStack gap="1" className={PANEL_CLASS}>
          <Text size="sm" weight="semibold">
            AI search unavailable
          </Text>
          <Paragraph size="sm" tone="subdued">
            Configure an OpenAI-compatible API key to use AI search. Lexical
            results above are unaffected.
          </Paragraph>
          <Link to={APP_ROUTES.SETTINGS_AGENT}>
            <Text size="sm" weight="semibold">
              Configure in Settings →
            </Text>
          </Link>
        </BlockStack>
      )}

      {rerankError && !isConfigError && rerankError instanceof Error && (
        <Paragraph size="sm" tone="subdued">
          AI search failed: {rerankError.message}
        </Paragraph>
      )}

      {!isEmpty && displayedResults.length > 0 && (
        <BlockStack gap="2">
          <Paragraph size="xs" tone="subdued">
            {rerankActive
              ? `AI-reranked ${displayedResults.length} result${displayedResults.length === 1 ? "" : "s"} for “${trimmedQuery}”`
              : `${displayedResults.length} result${displayedResults.length === 1 ? "" : "s"} for “${trimmedQuery}”`}
          </Paragraph>
          {displayedResults.map((result) => (
            <ComponentCard
              key={result.digest}
              reference={result.reference}
              matchedFields={result.matchedFields}
              reason={result.reason}
            />
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
};

/**
 * Merge LLM rerank results back into the lexical match metadata so the UI
 * can still show "matched: name" badges alongside the rerank reason. Items
 * the LLM dropped are appended after the reranked ones (the lexical layer
 * thought they were relevant, even if the LLM disagreed — surfacing them
 * builds trust by not silently hiding lexical hits).
 */
function mergeRerankIntoLexical(
  reranked: RerankedMatch[],
  lexical: LexicalMatch[],
): Array<LexicalMatch & { reason?: string }> {
  const lexicalByDigest = new Map(lexical.map((m) => [m.digest, m]));
  const out: Array<LexicalMatch & { reason?: string }> = [];

  for (const r of reranked) {
    const lex = lexicalByDigest.get(r.id);
    if (!lex) continue;
    out.push({ ...lex, reason: r.reason });
    lexicalByDigest.delete(r.id);
  }
  // Tail: lexical hits the LLM didn't rank.
  for (const lex of lexicalByDigest.values()) {
    out.push({ ...lex });
  }
  return out;
}
