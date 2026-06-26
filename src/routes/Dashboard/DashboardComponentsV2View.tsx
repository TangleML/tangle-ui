import Bugsnag from "@bugsnag/js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { listApiPublishedComponentsGet } from "@/api/sdk.gen";
import {
  ComponentDetail,
  ComponentDetailSkeleton,
} from "@/components/shared/ComponentDetail/ComponentDetail";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { QuickTooltip } from "@/components/ui/tooltip";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useDebouncedSearchValue } from "@/hooks/useDebouncedSearchValue";
import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
import {
  useComponentAiDescription,
  useNaturalLanguageComponentRerank,
} from "@/hooks/useNaturalLanguageComponentSearch";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
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
import { rankComponentMatchesByEmbeddings } from "@/services/componentSearchEmbeddings";
import {
  buildSearchIndex,
  type ComponentSearchSource,
  type IndexEntry,
  type LexicalMatch,
  lexicalSearch,
  type MatchField,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import { IS_BUGSNAG_ENABLED } from "@/services/errorManagement/bugsnag";
import {
  componentReferenceToCandidate,
  NaturalLanguageSearchConfigError,
  type RerankedMatch,
} from "@/services/naturalLanguageComponentSearchService";
import type { ComponentFolder } from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { componentMetadata } from "@/utils/componentTracking";
import { HOURS, TOP_NAV_HEIGHT } from "@/utils/constants";
import { getComponentName } from "@/utils/getComponentName";
import { tracking } from "@/utils/tracking";

import { APP_ROUTES } from "../router";
import { copyComponentReferenceToClipboard } from "../v2/shared/clipboard/copyComponentReferenceToClipboard";
import {
  createSourceFilterOptions,
  filterIndexByDisabledSourceKeys,
  SourceFilterBar,
} from "./DashboardComponentsV2SourceFilter";
import {
  createDashboardComponentsV2SearchParams,
  readComponentSearchQuery,
  readDisabledSourceKeys,
  readSelectedComponentDigest,
} from "./searchParams";

// Repeated Tailwind combos extracted as named constants.
const PANEL_CLASS = "p-3 rounded-lg bg-card border border-border";

// Maps V2's richer ComponentSearchSource.kind onto the analytics-tracking taxonomy
// (see analytics-tracking skill: `component_source` enum is fixed).
const TRACKING_SOURCE_BY_KIND: Record<
  ComponentSearchSource["kind"],
  "library" | "published" | "user"
> = {
  standard: "library",
  registered: "library",
  published: "published",
  user: "user",
};

// Source identity is communicated by the package icon's colour instead of a
// text badge — cleaner card, and the same colour shows up consistently across
// the list. Hover for the human-readable source name.
const SOURCE_ICON_TONE_BY_KIND: Record<ComponentSearchSource["kind"], string> =
  {
    standard: "text-blue-500",
    published: "text-emerald-500",
    registered: "text-violet-500",
    user: "text-amber-500",
  };

/** How many lexical hits to display before the user asks for AI judgment. */
const LEXICAL_RESULT_LIMIT = 20;
/** Bounded pool sent to AI search on click. */
const AI_CANDIDATE_LIMIT = 80;
const DASHBOARD_SEARCH_RESULT_DEBOUNCE_MS = 500;

const MATCH_FIELD_LABEL: Record<MatchField, string> = {
  name: "name",
  description: "description",
  io: "inputs/outputs",
  implementation: "command",
  metadata: "metadata",
};

// Built-in sources are constants — only registered libraries vary per row.
const STANDARD_SOURCE: ComponentSearchSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};
const PUBLISHED_SOURCE: ComponentSearchSource = {
  kind: "published",
  label: "Published",
  id: "published",
};
const USER_SOURCE: ComponentSearchSource = {
  kind: "user",
  label: "User",
  id: "user",
};

function registeredSource(library: StoredLibrary): ComponentSearchSource {
  return { kind: "registered", label: library.name, id: library.id };
}

function registeredLibraryConfigurationFingerprint(
  configuration: StoredLibrary["configuration"],
): string {
  if (!configuration) return "";

  const repoName = configuration.repo_name;
  const lastUpdatedAt = configuration.last_updated_at;
  const autoUpdate = configuration.auto_update;

  return JSON.stringify({
    repoName: typeof repoName === "string" ? repoName : "",
    lastUpdatedAt: typeof lastUpdatedAt === "string" ? lastUpdatedAt : "",
    autoUpdate: typeof autoUpdate === "boolean" ? autoUpdate : "",
  });
}

export function createRegisteredLibrariesFingerprint(
  libraries: StoredLibrary[] | undefined,
): string {
  if (!libraries) return "loading";

  return JSON.stringify(
    libraries
      .map((library) => ({
        id: library.id,
        type: library.type,
        name: library.name,
        knownDigests: [...library.knownDigests].sort(),
        configuration: registeredLibraryConfigurationFingerprint(
          library.configuration,
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

type ComponentLibraryFolder = Parameters<typeof flattenFolders>[0];
type UserFolder = { components?: ComponentReference[] };

interface ComponentCardProps {
  reference: ComponentReference;
  source?: ComponentSearchSource;
  matchedFields?: MatchField[];
  reason?: string;
  rerankScore?: number;
  isAiRanked?: boolean;
  isSelected?: boolean;
  /** Position within the current result list — passed to analytics. */
  position?: number;
  /** Whether the user had typed a query when this card was rendered. */
  hadQuery?: boolean;
  onSelect: (reference: ComponentReference) => void;
}

const ComponentCard = ({
  reference,
  source,
  matchedFields,
  reason,
  rerankScore,
  isAiRanked,
  isSelected,
  position,
  hadQuery,
  onSelect,
}: ComponentCardProps) => {
  const name = getComponentName(reference);
  const description = reference.spec?.description;
  const publishedBy = reference.published_by;
  const trackingSource = source
    ? TRACKING_SOURCE_BY_KIND[source.kind]
    : "unknown";
  const showLexicalMatchBadges = isAiRanked ? undefined : matchedFields;
  const showDescription = description;

  return (
    // Raw <button> rather than the <Button> primitive: the primitive's variants
    // are sized for compact text/icon buttons, not a full-width multi-line card
    // with an accent bar + selected/hover/focus states. Keeping the native
    // <button> preserves accessibility (aria-pressed, focus-visible ring) and
    // lets the card layout grow freely.
    <button
      type="button"
      onClick={() => onSelect(reference)}
      aria-pressed={isSelected}
      aria-label={`View details for ${name}`}
      className={cn(
        PANEL_CLASS,
        // Card is a button: align text, full width, subtle hover, focus ring.
        "w-full text-left cursor-pointer transition-colors",
        "hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        // Selected state: left accent bar + tinted background.
        isSelected &&
          "bg-muted/60 border-l-4 border-l-primary pl-[calc(0.75rem-3px)]",
      )}
      {...tracking("component_library.result_card_v2", {
        ...componentMetadata(reference, trackingSource),
        surface: "dashboard_v2",
        result_position: position,
        had_query: hadQuery,
        source_kind: source?.kind,
      })}
    >
      {/* min-w-0 so the flex column can shrink below its content width;
          without this, long unbroken URLs in the description force the
          card to grow horizontally. */}
      <BlockStack gap="2" className="min-w-0">
        <InlineStack gap="2" blockAlign="center" wrap="wrap">
          {source ? (
            <QuickTooltip content={source.label}>
              <Icon
                name="Package"
                size="sm"
                className={SOURCE_ICON_TONE_BY_KIND[source.kind]}
                aria-label={`Source: ${source.label}`}
              />
            </QuickTooltip>
          ) : (
            <Icon name="Package" size="sm" />
          )}
          <Text size="sm" weight="semibold">
            {name}
          </Text>
          {rerankScore !== undefined && (
            <Badge variant="secondary">
              Relevance: {Math.round(rerankScore * 100)}%
            </Badge>
          )}
          {showLexicalMatchBadges?.map((field) => (
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
        {showDescription && (
          // `[overflow-wrap:anywhere]` breaks at any character if needed —
          // `break-words` only breaks at word boundaries, which doesn't help
          // for long URLs without spaces. Pair with `min-w-0` on the parent
          // so the flex container actually allows shrinking.
          <Paragraph size="sm" className="[overflow-wrap:anywhere] min-w-0">
            {description}
          </Paragraph>
        )}
        {reason && (
          <Paragraph size="xs" tone="subdued">
            Why: {reason}
          </Paragraph>
        )}
      </BlockStack>
    </button>
  );
};

interface ComponentDescriptionPanelProps {
  prefilledDescription?: string;
  generatedDescription?: string;
  isGenerating: boolean;
  generationError: Error | null;
  isConfigured: boolean;
  onGenerate: () => void;
}

/**
 * Router-Link styled to read as a clickable link (color + hover underline).
 * Used wherever we point the user at the Agent settings page — keeps the
 * affordance consistent and avoids duplicating the link target string.
 */
const ConfigureInSettingsLink = () => (
  <Link
    to={APP_ROUTES.SETTINGS_AGENT}
    className="text-sm font-semibold text-primary hover:underline"
  >
    Configure in Settings →
  </Link>
);

type DescriptionPanelStatus =
  | { kind: "unconfigured" }
  | { kind: "error"; message: string }
  | { kind: "done"; text: string }
  | { kind: "generating" }
  | { kind: "idle" };

function getDescriptionPanelStatus({
  isConfigured,
  generationError,
  generatedDescription,
  isGenerating,
}: {
  isConfigured: boolean;
  generationError: Error | null;
  generatedDescription?: string;
  isGenerating: boolean;
}): DescriptionPanelStatus {
  if (!isConfigured) return { kind: "unconfigured" };
  if (generationError)
    return { kind: "error", message: generationError.message };
  if (generatedDescription) return { kind: "done", text: generatedDescription };
  if (isGenerating) return { kind: "generating" };
  return { kind: "idle" };
}

const ComponentDescriptionPanel = ({
  prefilledDescription,
  generatedDescription,
  isGenerating,
  generationError,
  isConfigured,
  onGenerate,
}: ComponentDescriptionPanelProps) => {
  const status = getDescriptionPanelStatus({
    isConfigured,
    generationError,
    generatedDescription,
    isGenerating,
  });

  const renderStatusBody = () => {
    switch (status.kind) {
      case "unconfigured":
        return (
          <Paragraph size="sm" tone="subdued">
            Configure AI settings to generate an AI description.
          </Paragraph>
        );
      case "error":
        return (
          <BlockStack gap="2" align="start">
            <Paragraph size="sm" tone="critical">
              Couldn&apos;t generate a description: {status.message}
            </Paragraph>
            <Button type="button" size="sm" onClick={onGenerate}>
              Try again
            </Button>
          </BlockStack>
        );
      case "done":
        return (
          <Paragraph size="sm" className="[overflow-wrap:anywhere]">
            {status.text}
          </Paragraph>
        );
      case "generating":
        return (
          <Paragraph size="sm" tone="subdued">
            Generating description…
          </Paragraph>
        );
      case "idle":
        return (
          <Button type="button" size="sm" onClick={onGenerate}>
            Generate AI description
          </Button>
        );
    }
  };

  return (
    <BlockStack gap="3">
      <BlockStack gap="1">
        <Text size="xs" weight="semibold" tone="subdued">
          Prefilled description
        </Text>
        <Paragraph size="sm" className="[overflow-wrap:anywhere]">
          {prefilledDescription?.trim() || "No prefilled description provided."}
        </Paragraph>
      </BlockStack>
      <BlockStack gap="1">
        <InlineStack gap="2" blockAlign="center">
          <Text size="xs" weight="semibold" tone="subdued">
            AI-generated description
          </Text>
          {isGenerating && <Spinner size={14} />}
        </InlineStack>
        {renderStatusBody()}
      </BlockStack>
      {!isConfigured && <ConfigureInSettingsLink />}
    </BlockStack>
  );
};

/**
 * Merge every component source the rest of the app knows about into a single
 * deduped, source-attributed list.
 *
 * Order matters: the first occurrence of a digest wins. Priority is
 * `standard > published > registered > user` so the most canonical label
 * sticks when the same component appears in multiple places.
 */
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

function DebouncedComponentSearchInput({
  onCommit,
  disabled,
  initialValue,
}: {
  onCommit: (value: string) => void;
  disabled: boolean;
  initialValue: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useDebouncedSearchValue(
    onCommit,
    DASHBOARD_SEARCH_RESULT_DEBOUNCE_MS,
    initialValue,
    () => document.activeElement !== inputRef.current,
  );

  return (
    <Input
      ref={inputRef}
      type="search"
      placeholder="e.g. train_test_split, pandas, clean up my data"
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      aria-label="Search components"
      disabled={disabled}
      className="flex-1"
    />
  );
}

function collectAllSourcedReferences({
  standardLibrary,
  publishedRefs,
  registeredSourced,
  userFolder,
}: {
  standardLibrary: ComponentLibraryFolder | undefined;
  publishedRefs: ComponentReference[];
  registeredSourced: SourcedReference[];
  userFolder: UserFolder | undefined;
}): SourcedReference[] {
  const all: SourcedReference[] = [];

  if (standardLibrary) {
    for (const ref of flattenFolders(standardLibrary)) {
      all.push({ reference: ref, source: STANDARD_SOURCE });
    }
  }
  for (const ref of publishedRefs) {
    all.push({ reference: ref, source: PUBLISHED_SOURCE });
  }
  for (const sr of registeredSourced) {
    all.push(sr);
  }
  for (const ref of userFolder?.components ?? []) {
    all.push({ reference: ref, source: USER_SOURCE });
  }

  // Dedupe by digest, preserving the first occurrence (which carries the
  // higher-priority source label). Refs without digests are dropped — the
  // search index requires them for LLM round-trip anyway.
  const seen = new Set<string>();
  const out: SourcedReference[] = [];
  for (const item of all) {
    const digest = item.reference.digest;
    if (!digest || seen.has(digest)) continue;
    seen.add(digest);
    out.push(item);
  }
  return out;
}

export const DashboardComponentsV2View = () => {
  const queryClient = useQueryClient();
  const aiDescriptionsEnabled = useFlagValue(
    "component-search-v2-ai-descriptions",
  );
  const { backendUrl, configured, available } = useBackend();
  const { config: aiConfig } = useAiProviderSettings();
  const dashboardSearch = useSearch({ strict: false });
  const queryFromUrl = readComponentSearchQuery(dashboardSearch);
  const disabledSourceKeysFromUrl = readDisabledSourceKeys(dashboardSearch);
  const disabledSourceKeysParam = disabledSourceKeysFromUrl.join(",");
  const [query, setQuery] = useState(queryFromUrl);
  const deferredQuery = useDeferredValue(query);
  const [, startSearchTransition] = useTransition();
  const [disabledSourceKeys, setDisabledSourceKeys] = useState<string[]>(
    disabledSourceKeysFromUrl,
  );

  // Detail-pane selection lives in the URL so refreshes preserve it and the
  // selection can be linked-to. The V2 route has no validateSearch defined.
  const navigate = useNavigate();
  const selectedDigest = readSelectedComponentDigest(dashboardSearch);
  const buildSearch = ({
    component = selectedDigest,
    q = query,
    sourceKeys = disabledSourceKeys,
  }: {
    component?: string | null;
    q?: string;
    sourceKeys?: string[];
  }) =>
    createDashboardComponentsV2SearchParams({
      component: component ?? undefined,
      q,
      disabledSourceKeys: sourceKeys,
    });
  const selectComponent = (reference: ComponentReference) => {
    navigate({
      to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
      search: buildSearch({ component: reference.digest }),
    });
  };
  const closeDetail = () => {
    navigate({
      to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
      search: buildSearch({ component: null }),
    });
  };

  useEffect(() => {
    startSearchTransition(() => setQuery(queryFromUrl));
  }, [queryFromUrl, startSearchTransition]);

  useEffect(() => {
    setDisabledSourceKeys(disabledSourceKeysFromUrl);
  }, [disabledSourceKeysParam]);

  // Close detail on Escape — only when something is open, so we don't fight
  // other Esc handlers (e.g. inside Inputs).
  useEffect(() => {
    if (!selectedDigest) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate({
          to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
          search: buildSearch({ component: null }),
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDigest, navigate, buildSearch]);

  // The dashboard search page doesn't mount `ComponentLibraryProvider` (which
  // is editor-scoped), so the GitHub library factory isn't auto-registered.
  // This runs once and is idempotent.
  useEffect(() => {
    ensureLibraryFactoriesRegistered();
  }, []);

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

  // Published components (backend). Gated on the backend being reachable; if
  // it isn't, we silently search without published rather than erroring —
  // matches the V1 dashboard behaviour.
  const { data: publishedRefs = [], isLoading: publishedLoading } = useQuery({
    queryKey: ["component-search-v2", "published", backendUrl],
    enabled: configured && available,
    staleTime: HOURS,
    queryFn: async (): Promise<ComponentReference[]> => {
      const result = await listApiPublishedComponentsGet({});
      if (result.response.status !== 200 || !result.data) return [];
      const list = result.data.published_components ?? [];
      return list
        .filter((c) => !c.deprecated)
        .map((c) => ({
          digest: c.digest,
          // Backend may return null; normalize to undefined to fit ComponentReference.
          name: c.name ?? undefined,
          url: c.url ?? `${backendUrl}/api/components/${c.digest}`,
          published_by: c.published_by,
        }));
    },
  });

  // Dexie is only the source of which libraries are registered. Fetching
  // remote/GitHub library contents stays in TanStack Query so loading, errors,
  // and cache lifetime follow the rest of the app's server-state conventions.
  //
  // No default value: `registeredLibraries` is `undefined` until Dexie resolves
  // so downstream `=== undefined` loading checks fire correctly. Returning an
  // empty `[]` default would race the first paint with a momentary
  // empty-results state for users whose library is mostly registered.
  const registeredLibraries = useLiveQuery<StoredLibrary[]>(async () => {
    ensureLibraryFactoriesRegistered();
    return LibraryDB.component_libraries.toArray();
  }, []);

  const registeredLibrariesFingerprint =
    createRegisteredLibrariesFingerprint(registeredLibraries);

  const { data: registeredSourced = [], isLoading: registeredQueryLoading } =
    useQuery({
      queryKey: [
        "component-search-v2",
        "registered-libraries",
        registeredLibrariesFingerprint,
      ],
      enabled: registeredLibraries !== undefined,
      staleTime: HOURS,
      queryFn: async (): Promise<SourcedReference[]> => {
        if (!registeredLibraries || registeredLibraries.length === 0) return [];

        const results = await Promise.allSettled(
          registeredLibraries.map(async (storage) => {
            const lib = createLibraryObject(storage);
            const folder: ComponentFolder = await lib.getComponents({});
            return { storage, folder };
          }),
        );

        const out: SourcedReference[] = [];
        for (const result of results) {
          if (result.status !== "fulfilled") {
            // One broken library shouldn't kill the whole search — surface the
            // failure to Bugsnag (gated by IS_BUGSNAG_ENABLED) so we can act on
            // it, but keep a console.warn for dev visibility.
            const reason =
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason));
            if (IS_BUGSNAG_ENABLED) {
              Bugsnag.notify(reason, (event) => {
                event.addMetadata("components_v2", {
                  message: "registered library failed to load",
                });
              });
            }
            console.warn(
              "Components: registered library failed to load",
              result.reason,
            );
            continue;
          }
          const source = registeredSource(result.value.storage);
          for (const ref of flattenFolders(result.value.folder)) {
            out.push({ reference: ref, source });
          }
        }
        return out;
      },
    });

  const registeredLoading =
    registeredLibraries === undefined || registeredQueryLoading;

  const allSourced = collectAllSourcedReferences({
    standardLibrary: componentLibrary,
    publishedRefs,
    registeredSourced,
    userFolder,
  });

  // Fingerprint of which refs are in play. Changes when the library set
  // changes, so the hydration cache invalidates appropriately.
  const referencesFingerprint = allSourced
    .map((s) => s.reference.digest ?? s.reference.url ?? "")
    .sort()
    .join("|");

  // Use `isLoading` (first fetch only), not `isFetching` (any fetch). A
  // background refetch shouldn't flip the page back to a skeleton state.
  const { data: hydratedReferences, isLoading: hydrating } = useQuery({
    queryKey: ["component-search-v2", "hydrate-library", referencesFingerprint],
    enabled: allSourced.length > 0,
    staleTime: HOURS,
    queryFn: async () => {
      const results = await Promise.all(
        allSourced.map((sourced) =>
          // Reuse the same cache key as useHydrateComponentReference so
          // individual component cards elsewhere in the app share hydration.
          queryClient
            .ensureQueryData({
              queryKey: [
                "component",
                "hydrate",
                getComponentQueryKey(sourced.reference),
              ],
              staleTime: HOURS,
              queryFn: () => hydrateComponentReference(sourced.reference),
            })
            .catch(() => null),
        ),
      );
      return results.filter((r): r is HydratedComponentReference => r !== null);
    },
  });

  // Pair hydrated refs back with their source by digest. Hydration preserves
  // digests, so this is a straightforward join.
  const sourceByDigest = new Map<string, ComponentSearchSource>();
  for (const sourced of allSourced) {
    if (sourced.reference.digest) {
      sourceByDigest.set(sourced.reference.digest, sourced.source);
    }
  }
  const sourcedHydrated: SourcedReference[] = [];
  for (const reference of hydratedReferences ?? []) {
    const source = sourceByDigest.get(reference.digest);
    if (!source) continue;
    sourcedHydrated.push({ reference, source });
  }

  // The search index is a pure derivation. React Compiler will memoize this.
  const index: IndexEntry[] = buildSearchIndex(sourcedHydrated);
  const sourceFilterOptions = createSourceFilterOptions(index);
  const filteredIndex = filterIndexByDisabledSourceKeys(
    index,
    disabledSourceKeys,
  );
  const total = filteredIndex.length;
  const totalAcrossSources = index.length;

  // Alphabetical order for the browse-all view. Predictable scrolling beats
  // "whatever order the library happened to load in."
  const sortedIndex = [...filteredIndex].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const trimmedQuery = deferredQuery.trim();

  // One lexical pass at the wider AI-candidate limit; the display list is the
  // top slice of that same scored result, so we never score and sort the index
  // twice per render. `lexicalSearch` already orders by score desc then name
  // asc, so slicing is equivalent to a separate narrower search.
  const broadLexicalMatches: LexicalMatch[] =
    trimmedQuery.length === 0
      ? []
      : lexicalSearch(filteredIndex, deferredQuery, {
          limit: AI_CANDIDATE_LIMIT,
        });

  const lexicalMatches: LexicalMatch[] = broadLexicalMatches.slice(
    0,
    LEXICAL_RESULT_LIMIT,
  );
  const aiCandidateMatches: LexicalMatch[] = (() => {
    if (trimmedQuery.length === 0) return [];
    return broadLexicalMatches;
  })();
  const canUseEmbeddingSearch = aiConfig.apiBase.trim().length > 0;

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
  const [rerankBaseMatches, setRerankBaseMatches] = useState<LexicalMatch[]>(
    [],
  );
  const [isEmbeddingSearchPending, setIsEmbeddingSearchPending] =
    useState(false);

  const clearRerank = () => {
    setRerankedFor(null);
    setRerankBaseMatches([]);
    resetRerank();
  };

  const handleQueryCommit = (value: string) => {
    startSearchTransition(() => {
      setQuery(value);
      if (rerankedFor !== null) {
        clearRerank();
      }
    });
  };

  const buildEmbeddingMatches = async (
    trimmed: string,
    limit: number,
  ): Promise<LexicalMatch[]> => {
    if (!canUseEmbeddingSearch) return [];
    setIsEmbeddingSearchPending(true);
    try {
      return await rankComponentMatchesByEmbeddings(
        filteredIndex,
        trimmed,
        { apiBase: aiConfig.apiBase, apiKey: aiConfig.apiKey },
        { limit },
      );
    } catch {
      return [];
    } finally {
      setIsEmbeddingSearchPending(false);
    }
  };

  const startAiSearch = async (
    matches: LexicalMatch[],
    {
      scoreAllCandidates,
      limit,
    }: { scoreAllCandidates: boolean; limit: number },
  ) => {
    const trimmed = trimmedQuery;
    if (trimmed.length === 0) return;
    if (matches.length === 0 && !canUseEmbeddingSearch) return;

    const embeddingMatches = canUseEmbeddingSearch
      ? await buildEmbeddingMatches(trimmed, limit)
      : [];
    const rerankMatches = mergeUniqueMatches(
      matches.slice(0, 60),
      embeddingMatches,
      matches,
      limit,
    );

    const candidates = rerankMatches
      .map((m) => componentReferenceToCandidate(m.reference, m.source))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (candidates.length === 0) return;

    setRerankBaseMatches(rerankMatches);
    setRerankedFor(trimmed);
    rerank({ query: trimmed, candidates, scoreAllCandidates });
  };

  const handleSmartSearch = () => {
    void startAiSearch(aiCandidateMatches, {
      scoreAllCandidates: true,
      limit: aiCandidateMatches.length || LEXICAL_RESULT_LIMIT,
    });
  };

  useEffect(() => {
    if (query === queryFromUrl) return;
    const timeout = window.setTimeout(() => {
      navigate({
        to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
        search: createDashboardComponentsV2SearchParams({
          component: selectedDigest,
          q: query,
          disabledSourceKeys,
        }),
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [query, queryFromUrl, selectedDigest, disabledSourceKeys, navigate]);

  const handleSourceToggle = (sourceKey: string) => {
    const nextDisabledSourceKeys = disabledSourceKeys.includes(sourceKey)
      ? disabledSourceKeys.filter((key) => key !== sourceKey)
      : [...disabledSourceKeys, sourceKey];
    setDisabledSourceKeys(nextDisabledSourceKeys);
    navigate({
      to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
      search: buildSearch({ sourceKeys: nextDisabledSourceKeys }),
    });
    if (rerankedFor !== null) {
      clearRerank();
    }
  };

  const handleEnableAllSources = () => {
    setDisabledSourceKeys([]);
    navigate({
      to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
      search: buildSearch({ sourceKeys: [] }),
    });
    if (rerankedFor !== null) {
      clearRerank();
    }
  };

  const isLoadingLibrary =
    libraryLoading ||
    userLoading ||
    publishedLoading ||
    registeredLoading ||
    hydrating;
  const noLibraryData = !isLoadingLibrary && totalAcrossSources === 0;
  const isEmpty = trimmedQuery.length === 0;
  const isConfigError = rerankError instanceof NaturalLanguageSearchConfigError;
  // Only treat rerank as "active" when the model actually returned matches.
  // An empty result set (model decided nothing fit, or the response was
  // malformed and the service degraded it to `{ matches: [] }`) means the
  // ordering we'd render is plain lexical — labeling that "AI-reranked"
  // would lie to the user.
  const rerankActive =
    rerankedFor !== null &&
    rerankedFor === trimmedQuery &&
    rerankData !== undefined &&
    rerankData.matches.length > 0 &&
    rerankBaseMatches.length > 0 &&
    !isReranking &&
    !isEmbeddingSearchPending;

  // What we actually render. Rerank wins when active; otherwise lexical.
  const displayedResults: Array<
    LexicalMatch & { reason?: string; rerankScore?: number }
  > = rerankActive
    ? mergeRerankIntoLexical(rerankData.matches, rerankBaseMatches)
    : lexicalMatches.map((m) => ({
        ...m,
        reason: undefined,
        rerankScore: undefined,
      }));

  // Resolve the full reference for the selected digest. Prefer the already-
  // hydrated copy (no extra network), fall back to the un-hydrated index
  // entry, then to a backend stub. The shared ComponentDetail will suspend on
  // hydration as needed and shares cache with the rest of the app.
  const selectedReference: ComponentReference | undefined = (() => {
    if (!selectedDigest) return undefined;
    const hydrated = sourcedHydrated.find(
      (s) => s.reference.digest === selectedDigest,
    );
    if (hydrated) return hydrated.reference;
    const indexed = allSourced.find(
      (s) => s.reference.digest === selectedDigest,
    );
    if (indexed) return indexed.reference;
    return {
      digest: selectedDigest,
      url: `${backendUrl}/api/components/${selectedDigest}`,
    };
  })();
  const isDetailOpen = Boolean(selectedDigest);

  // AI description query. Keyed by digest so each component gets its own
  // cached result, isolated error/pending, and an AbortSignal that fires
  // when the user switches components mid-flight (no more uncancellable
  // billed calls). `enabled` opts into auto-generation when the flag is on;
  // when off, the panel's "Generate AI description" button calls
  // `refetchDescription()` manually.
  const {
    description: selectedGeneratedDescription,
    isFetching: isGeneratingDescription,
    error: descriptionError,
    refetch: refetchDescription,
    isConfigured: canGenerateDescription,
  } = useComponentAiDescription({
    reference: selectedReference,
    enabled: aiDescriptionsEnabled,
  });
  const notify = useToastNotification();

  const handleGenerateDescription = () => {
    if (!selectedReference?.digest || !selectedReference.spec) return;
    if (!canGenerateDescription) return;
    refetchDescription();
  };

  const handleCopyLink = async () => {
    if (!selectedDigest) return;
    if (!navigator.clipboard) {
      notify(
        "Couldn't copy link. Check browser permissions and try again.",
        "error",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Component link copied to clipboard", "success");
    } catch {
      notify(
        "Couldn't copy link. Check browser permissions and try again.",
        "error",
      );
    }
  };

  const handleCopyToPipeline = async () => {
    if (!selectedReference) return;
    try {
      await copyComponentReferenceToClipboard(selectedReference);
      notify(
        "Component copied. Paste (Cmd/Ctrl+V) into a pipeline to add it.",
        "success",
      );
    } catch {
      notify(
        "Couldn't copy to clipboard. Check browser permissions and try again.",
        "error",
      );
    }
  };

  // Render helpers — keeps the JSX below tidy. These read the closed-over
  // state from the surrounding component; React Compiler memoises them.
  const renderResults = () => {
    if (isLoadingLibrary) {
      return (
        <BlockStack gap="2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </BlockStack>
      );
    }
    if (noLibraryData) {
      return (
        <Paragraph size="sm" tone="subdued">
          No components found in your library.
        </Paragraph>
      );
    }
    if (total === 0) {
      return (
        <Paragraph size="sm" tone="subdued">
          No components in the selected sources.
        </Paragraph>
      );
    }
    if (isEmpty) {
      return (
        <BlockStack gap="2" align="stretch">
          <Paragraph size="xs" tone="subdued">
            {total} component{total === 1 ? "" : "s"} in selected sources. Start
            typing to search.
          </Paragraph>
          {sortedIndex.map((entry, idx) => (
            <ComponentCard
              key={entry.digest}
              reference={entry.reference}
              source={entry.source}
              isSelected={entry.digest === selectedDigest}
              position={idx}
              hadQuery={false}
              onSelect={selectComponent}
            />
          ))}
        </BlockStack>
      );
    }
    if (lexicalMatches.length === 0 && !rerankActive) {
      return (
        <Paragraph size="sm" tone="subdued">
          No components matched “{trimmedQuery}”. Try different terms or check
          for typos.
        </Paragraph>
      );
    }
    return (
      <BlockStack gap="2" align="stretch">
        <InlineStack align="space-between" blockAlign="center" gap="2">
          <Paragraph size="xs" tone="subdued">
            {rerankActive
              ? `AI-ranked ${displayedResults.length} result${displayedResults.length === 1 ? "" : "s"} for “${trimmedQuery}”`
              : `${displayedResults.length} result${displayedResults.length === 1 ? "" : "s"} for “${trimmedQuery}”`}
          </Paragraph>
          {rerankActive && (
            <Button
              type="button"
              variant="link"
              size="inline-xs"
              onClick={clearRerank}
            >
              Use lexical ranking
            </Button>
          )}
        </InlineStack>
        {displayedResults.map((result, idx) => (
          <ComponentCard
            key={result.digest}
            reference={result.reference}
            source={result.source}
            matchedFields={result.matchedFields}
            reason={result.reason}
            rerankScore={result.rerankScore}
            isAiRanked={rerankActive}
            isSelected={result.digest === selectedDigest}
            position={idx}
            hadQuery={true}
            onSelect={selectComponent}
          />
        ))}
      </BlockStack>
    );
  };

  return (
    // App-shell layout: escape the dashboard's outer padding (`-mt-4 -mb-6
    // -mx-8`) so we can paint a fixed-height shell with our own internal
    // padding per zone. Raw flex-col here (rather than BlockStack) because we
    // need the inline `style={{ height }}` AND independent vertical-scroll
    // columns — both BlockStack's typed props and its `items-start` /
    // `min-height: auto` defaults fight against that flex chain.
    <div
      className="flex flex-col -mt-4 -mb-6 -mx-8 overflow-hidden"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      {/* Header zone: page title, description, search input. shrink-0 so it
          never gets squeezed by the body below. */}
      <div className="shrink-0 px-8 pt-4 pb-4 border-b border-border">
        <BlockStack gap="3" align="stretch">
          <BlockStack gap="1">
            <Heading level={2}>Components</Heading>
            <Paragraph size="sm" tone="subdued">
              Type to search across every component source — standard library,
              your published components, registered libraries, and local user
              components. Results match on name, description, inputs/outputs,
              and container command. Use AI search to rerank with an LLM when
              literal matching isn&apos;t enough.
            </Paragraph>
          </BlockStack>
          <InlineStack gap="3" blockAlign="center" wrap="nowrap">
            <DebouncedComponentSearchInput
              onCommit={handleQueryCommit}
              disabled={isLoadingLibrary || noLibraryData}
              initialValue={queryFromUrl}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={handleSmartSearch}
              disabled={
                isReranking ||
                isEmbeddingSearchPending ||
                isEmpty ||
                (aiCandidateMatches.length === 0 && !canUseEmbeddingSearch) ||
                !isConfigured
              }
              aria-label={
                isReranking || isEmbeddingSearchPending
                  ? "AI search in progress"
                  : "AI search"
              }
              title="AI search — rerank a bounded set of top candidates with an LLM"
            >
              {isReranking || isEmbeddingSearchPending ? (
                <Spinner size={16} />
              ) : (
                <Icon name="Sparkles" />
              )}
            </Button>
          </InlineStack>
          <SourceFilterBar
            options={sourceFilterOptions}
            disabledSourceKeys={disabledSourceKeys}
            onToggle={handleSourceToggle}
            onEnableAll={handleEnableAllSources}
          />
        </BlockStack>
      </div>

      {/* Body zone: two scroll columns. Raw flex-row (rather than
          InlineStack) because InlineStack's `items-start` default would
          collapse each column to its content height and break the inner
          `overflow-y-auto`. `min-h-0` lets the row shrink below content so
          its children's overflow can clip. */}
      <div className="flex flex-1 min-h-0">
        {/* Results column — own scroll. When detail is open, narrows to a
              fixed width with a divider; otherwise fills the whole body.
              `min-h-0` is critical: flex items default to `min-height: auto`
              which lets content push the column past the parent's height and
              breaks the `overflow-y-auto` clip. */}
        <div
          className={cn(
            "min-h-0 min-w-0 overflow-y-auto px-8 py-4",
            isDetailOpen
              ? "w-[360px] shrink-0 border-r border-border"
              : "flex-1",
          )}
        >
          {/* AI-search-unavailable banner and rerank error live in the
              results column — they describe what just happened to the
              search the user is looking at. */}
          {!isConfigured && !isEmpty && aiCandidateMatches.length > 0 && (
            <BlockStack gap="1" className={cn(PANEL_CLASS, "mb-3")}>
              <Text size="sm" weight="semibold">
                AI search unavailable
              </Text>
              <Paragraph size="sm" tone="subdued">
                Configure an OpenAI-compatible provider to use AI search. Search
                results are unaffected.
              </Paragraph>
              <ConfigureInSettingsLink />
            </BlockStack>
          )}
          {rerankError && !isConfigError && rerankError instanceof Error && (
            <Paragraph size="sm" tone="subdued" className="mb-3">
              AI search failed: {rerankError.message}
            </Paragraph>
          )}
          {renderResults()}
        </div>

        {/* Detail column — own scroll. Close button sticky to the top of
              this column's scroll viewport so it stays reachable.
              Same `min-h-0` rule as the results column above. */}
        {isDetailOpen && selectedReference && (
          <div
            role="region"
            aria-label="Component details"
            className="flex-1 min-h-0 min-w-0 overflow-y-auto px-8 py-4 relative"
          >
            {/* Sticky action row: copy + close. `float-right` here is
                intentional — it lets the row sit above the content without
                taking flow space, and the detail's first heading flows up
                next to it. Outer div handles sticky/positioning; inner
                InlineStack handles the button row's layout. */}
            <div className="sticky top-0 float-right z-10 bg-background/80 backdrop-blur-sm rounded-md">
              <InlineStack gap="1">
                <QuickTooltip content="Copy link" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyLink}
                    aria-label="Copy component link"
                    {...tracking(
                      "component_library.result_detail_v2.copy_link_button",
                      {
                        surface: "dashboard_v2",
                      },
                    )}
                  >
                    <Icon name="Link" />
                  </Button>
                </QuickTooltip>
                <QuickTooltip content="Copy to clipboard" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyToPipeline}
                    aria-label="Copy component to clipboard"
                    {...tracking(
                      "component_library.result_detail_v2.copy_button",
                      {
                        surface: "dashboard_v2",
                      },
                    )}
                  >
                    <Icon name="Copy" />
                  </Button>
                </QuickTooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeDetail}
                  aria-label="Close component details"
                  {...tracking(
                    "component_library.result_detail_v2.close_button",
                    {
                      surface: "dashboard_v2",
                    },
                  )}
                >
                  <Icon name="X" />
                </Button>
              </InlineStack>
            </div>
            <BlockStack gap="6" align="stretch">
              <ComponentDescriptionPanel
                prefilledDescription={selectedReference.spec?.description}
                generatedDescription={selectedGeneratedDescription}
                isGenerating={
                  isGeneratingDescription && !selectedGeneratedDescription
                }
                generationError={descriptionError}
                isConfigured={canGenerateDescription}
                onGenerate={handleGenerateDescription}
              />
              <SuspenseWrapper fallback={<ComponentDetailSkeleton />}>
                <ComponentDetail
                  key={selectedDigest}
                  reference={selectedReference}
                  layout="stacked"
                  sourcePanelHeight="480px"
                  hideDescription
                />
              </SuspenseWrapper>
            </BlockStack>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Merge LLM rerank results back into the lexical match metadata. AI search
 * keeps unranked lexical matches after the model-ranked set.
 */
function mergeRerankIntoLexical(
  reranked: RerankedMatch[],
  lexical: LexicalMatch[],
): Array<LexicalMatch & { reason?: string; rerankScore?: number }> {
  const lexicalByDigest = new Map(lexical.map((m) => [m.digest, m]));
  const out: Array<LexicalMatch & { reason?: string; rerankScore?: number }> =
    [];

  for (const r of reranked) {
    const lex = lexicalByDigest.get(r.id);
    if (!lex) continue;
    out.push({ ...lex, reason: r.reason, rerankScore: r.score });
    lexicalByDigest.delete(r.id);
  }
  for (const lex of lexicalByDigest.values()) {
    out.push({ ...lex });
  }
  return out;
}
