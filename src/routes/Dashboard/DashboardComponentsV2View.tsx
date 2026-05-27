import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { type ChangeEvent, useEffect, useState } from "react";

import { listApiPublishedComponentsGet } from "@/api/sdk.gen";
import {
  ComponentDetail,
  ComponentDetailSkeleton,
} from "@/components/shared/ComponentDetail/ComponentDetail";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickTooltip } from "@/components/ui/tooltip";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
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
import {
  buildSearchIndex,
  type ComponentSource,
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
import type { ComponentFolder } from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { componentMetadata } from "@/utils/componentTracking";
import { HOURS, TOP_NAV_HEIGHT } from "@/utils/constants";
import { getComponentName } from "@/utils/getComponentName";
import { tracking } from "@/utils/tracking";
import { isRecord } from "@/utils/typeGuards";

import { APP_ROUTES } from "../router";

// Repeated Tailwind combos extracted as named constants.
const PANEL_CLASS = "p-3 rounded-lg bg-card border border-border";

// Maps V2's richer ComponentSource.kind onto the analytics-tracking taxonomy
// (see analytics-tracking skill: `component_source` enum is fixed).
const TRACKING_SOURCE_BY_KIND: Record<
  ComponentSource["kind"],
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
const SOURCE_ICON_TONE_BY_KIND: Record<ComponentSource["kind"], string> = {
  standard: "text-blue-500",
  published: "text-emerald-500",
  registered: "text-violet-500",
  user: "text-amber-500",
};

/** How many lexical hits to display. */
const LEXICAL_RESULT_LIMIT = 20;

const MATCH_FIELD_LABEL: Record<MatchField, string> = {
  name: "name",
  description: "description",
  io: "inputs/outputs",
  implementation: "command",
};

export interface SourceFilterOption {
  source: ComponentSource;
  count: number;
}

function sourceFilterKey(source: ComponentSource): string {
  return `${source.kind}:${source.id}`;
}

function createSourceFilterOptions(index: IndexEntry[]): SourceFilterOption[] {
  const optionsByKey = new Map<string, SourceFilterOption>();

  for (const entry of index) {
    const key = sourceFilterKey(entry.source);
    const option = optionsByKey.get(key);
    if (option) {
      option.count += 1;
    } else {
      optionsByKey.set(key, { source: entry.source, count: 1 });
    }
  }

  return Array.from(optionsByKey.values());
}

interface SourceFilterBarProps {
  options: SourceFilterOption[];
  disabledSourceKeys: string[];
  onToggle: (sourceKey: string) => void;
  onEnableAll: () => void;
}

export const SourceFilterBar = ({
  options,
  disabledSourceKeys,
  onToggle,
  onEnableAll,
}: SourceFilterBarProps) => {
  if (options.length <= 1) return null;

  const disabled = new Set(disabledSourceKeys);
  const activeCount = options.filter(
    (option) => !disabled.has(sourceFilterKey(option.source)),
  ).length;

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center" wrap="wrap">
        <Text size="xs" tone="subdued">
          Sources
        </Text>
        {options.map(({ source, count }) => {
          const key = sourceFilterKey(source);
          const active = !disabled.has(key);
          return (
            <Button
              key={key}
              type="button"
              size="xs"
              variant={active ? "secondary" : "outline"}
              aria-pressed={active}
              aria-label={`${active ? "Hide" : "Show"} ${source.label} source (${count} component${count === 1 ? "" : "s"})`}
              onClick={() => onToggle(key)}
              className={cn(!active && "opacity-60")}
            >
              <Icon
                name="Package"
                size="sm"
                className={SOURCE_ICON_TONE_BY_KIND[source.kind]}
              />
              {source.label}
              <Text as="span" size="xs" tone="subdued">
                {count}
              </Text>
            </Button>
          );
        })}
        {activeCount < options.length && (
          <Button type="button" size="xs" variant="ghost" onClick={onEnableAll}>
            Show all
          </Button>
        )}
      </InlineStack>
      {activeCount === 0 && (
        <Paragraph size="xs" tone="subdued">
          No sources selected. Turn on at least one source to show components.
        </Paragraph>
      )}
    </BlockStack>
  );
};

// Built-in sources are constants — only registered libraries vary per row.
const STANDARD_SOURCE: ComponentSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};
const PUBLISHED_SOURCE: ComponentSource = {
  kind: "published",
  label: "Published",
  id: "published",
};
const USER_SOURCE: ComponentSource = {
  kind: "user",
  label: "User",
  id: "user",
};

function registeredSource(library: StoredLibrary): ComponentSource {
  return { kind: "registered", label: library.name, id: library.id };
}

function readSelectedComponentDigest(search: unknown): string | undefined {
  if (!isRecord(search)) return undefined;
  return typeof search.component === "string" ? search.component : undefined;
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
        knownDigestsCount: library.knownDigests.length,
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
  source?: ComponentSource;
  matchedFields?: MatchField[];
  reason?: string;
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

  return (
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
        {description && (
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

/**
 * Merge every component source the rest of the app knows about into a single
 * deduped, source-attributed list.
 *
 * Order matters: the first occurrence of a digest wins. Priority is
 * `standard > published > registered > user` so the most canonical label
 * sticks when the same component appears in multiple places.
 */
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
  const { backendUrl, configured, available } = useBackend();
  const [query, setQuery] = useState("");
  const [disabledSourceKeys, setDisabledSourceKeys] = useState<string[]>([]);

  // Detail-pane selection lives in the URL so refreshes preserve it and the
  // selection can be linked-to. The V2 route has no validateSearch defined.
  const navigate = useNavigate();
  const selectedDigest = readSelectedComponentDigest(
    useSearch({ strict: false }),
  );
  const selectComponent = (reference: ComponentReference) => {
    navigate({
      to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
      search: { component: reference.digest },
    });
  };
  const closeDetail = () => {
    navigate({ to: APP_ROUTES.DASHBOARD_COMPONENTS_V2, search: {} });
  };

  // Close detail on Escape — only when something is open, so we don't fight
  // other Esc handlers (e.g. inside Inputs). Navigate inline so the effect has
  // no callback dep that would re-bind on every render.
  useEffect(() => {
    if (!selectedDigest) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate({ to: APP_ROUTES.DASHBOARD_COMPONENTS_V2, search: {} });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDigest, navigate]);

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
  const registeredLibraries = useLiveQuery<StoredLibrary[], StoredLibrary[]>(
    async () => {
      ensureLibraryFactoriesRegistered();
      return LibraryDB.component_libraries.toArray();
    },
    [],
    [],
  );

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
            // One broken library shouldn't kill the whole search.
            console.warn(
              "Components V2: registered library failed to load",
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
  const sourceByDigest = new Map<string, ComponentSource>();
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
  const disabledSourceKeySet = new Set(disabledSourceKeys);
  const filteredIndex = index.filter(
    (entry) => !disabledSourceKeySet.has(sourceFilterKey(entry.source)),
  );
  const total = filteredIndex.length;
  const totalAcrossSources = index.length;

  // Alphabetical order for the browse-all view. Predictable scrolling beats
  // "whatever order the library happened to load in."
  const sortedIndex = [...filteredIndex].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const lexicalMatches: LexicalMatch[] = lexicalSearch(filteredIndex, query, {
    limit: LEXICAL_RESULT_LIMIT,
  });

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleSourceToggle = (sourceKey: string) => {
    setDisabledSourceKeys((current) =>
      current.includes(sourceKey)
        ? current.filter((key) => key !== sourceKey)
        : [...current, sourceKey],
    );
  };

  const handleEnableAllSources = () => {
    setDisabledSourceKeys([]);
  };

  const isLoadingLibrary =
    libraryLoading ||
    userLoading ||
    publishedLoading ||
    registeredLoading ||
    hydrating;
  const noLibraryData = !isLoadingLibrary && totalAcrossSources === 0;
  const trimmedQuery = query.trim();
  const isEmpty = trimmedQuery.length === 0;
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
    if (lexicalMatches.length === 0) {
      return (
        <Paragraph size="sm" tone="subdued">
          No components matched “{trimmedQuery}”. Try different terms or check
          for typos.
        </Paragraph>
      );
    }
    return (
      <BlockStack gap="2" align="stretch">
        <Paragraph size="xs" tone="subdued">
          {lexicalMatches.length} result{lexicalMatches.length === 1 ? "" : "s"}{" "}
          for “{trimmedQuery}”
        </Paragraph>
        {lexicalMatches.map((result, idx) => (
          <ComponentCard
            key={result.digest}
            reference={result.reference}
            source={result.source}
            matchedFields={result.matchedFields}
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
    // padding per zone. Header is always visible; the body below has two
    // independent scroll columns.
    <div
      className="flex flex-col -mt-4 -mb-6 -mx-8 overflow-hidden"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      {/* Header zone: page title, description, search input. shrink-0 so it
          never gets squeezed by the body below. */}
      <div className="shrink-0 px-8 pt-4 pb-4 border-b border-border">
        <BlockStack gap="3" align="stretch">
          <BlockStack gap="1">
            <Heading level={2}>Components V2</Heading>
            <Paragraph size="sm" tone="subdued">
              Type to search across every component source — standard library,
              your published components, registered libraries, and local user
              components. Results match on name, description, inputs/outputs,
              and container command.
            </Paragraph>
          </BlockStack>
          <Input
            type="search"
            placeholder="e.g. train_test_split, pandas, clean up my data"
            value={query}
            onChange={handleQueryChange}
            aria-label="Search components"
            disabled={isLoadingLibrary || noLibraryData}
            className="flex-1"
          />
          <SourceFilterBar
            options={sourceFilterOptions}
            disabledSourceKeys={disabledSourceKeys}
            onToggle={handleSourceToggle}
            onEnableAll={handleEnableAllSources}
          />
        </BlockStack>
      </div>

      {/* Body zone: two scroll columns. `min-h-0` is required so the flex
          children can shrink and scroll instead of growing the parent. */}
      <div className="flex-1 min-h-0 flex">
        {/* Results column — own scroll. When detail is open, narrows to a
            fixed width with a divider; otherwise fills the whole body. */}
        <div
          className={cn(
            "min-w-0 overflow-y-auto px-8 py-4",
            isDetailOpen
              ? "w-[360px] shrink-0 border-r border-border"
              : "flex-1",
          )}
        >
          {renderResults()}
        </div>

        {/* Detail column — own scroll. Close button sticky to the top of
            this column's scroll viewport so it stays reachable. */}
        {isDetailOpen && selectedReference && (
          <div
            role="region"
            aria-label="Component details"
            className="flex-1 min-w-0 overflow-y-auto px-8 py-4 relative"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={closeDetail}
              aria-label="Close component details"
              className="sticky top-0 float-right z-10 bg-background/80 backdrop-blur-sm rounded-md"
            >
              <Icon name="X" />
            </Button>
            <SuspenseWrapper fallback={<ComponentDetailSkeleton />}>
              <ComponentDetail
                key={selectedDigest}
                reference={selectedReference}
                layout="stacked"
                sourcePanelHeight="480px"
              />
            </SuspenseWrapper>
          </div>
        )}
      </div>
    </div>
  );
};
