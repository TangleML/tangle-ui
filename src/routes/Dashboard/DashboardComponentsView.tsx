import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

import type { ListPublishedComponentsResponse } from "@/api/types.gen";
import {
  ComponentDetail,
  ComponentDetailSkeleton,
} from "@/components/shared/ComponentDetail/ComponentDetail";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchUserComponents,
  flattenFolders,
} from "@/providers/ComponentLibraryProvider/componentLibrary";
import { APP_ROUTES } from "@/routes/router";
import { fetchAndStoreComponentLibrary } from "@/services/componentService";
import type { ComponentFolder } from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";
import { componentMetadata } from "@/utils/componentTracking";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import { getComponentName } from "@/utils/getComponentName";
import { tracking } from "@/utils/tracking";

import { readSelectedComponentDigest } from "./searchParams";

type ComponentRowSection = "user" | "library" | "published";

const PUBLISHED_COMPONENTS_URL = "/api/published_components/";

// ─── Collapsible section header ──────────────────────────────────────────────

const CollapsibleSection = ({
  label,
  count,
  defaultOpen = true,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) => (
  <Collapsible defaultOpen={defaultOpen}>
    <CollapsibleTrigger className="group w-full flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-b border-border/50 sticky top-0 z-10 hover:bg-muted/60 cursor-pointer">
      <Icon
        name="ChevronRight"
        className="text-muted-foreground transition-transform shrink-0 group-data-[state=open]:rotate-90"
        size="sm"
      />
      <Text
        size="xs"
        className="text-muted-foreground font-medium uppercase tracking-wide flex-1 text-left"
      >
        {label}
      </Text>
      <Text size="xs" className="text-muted-foreground tabular-nums">
        {count}
      </Text>
    </CollapsibleTrigger>
    <CollapsibleContent>{children}</CollapsibleContent>
  </Collapsible>
);

// ─── Shared row ──────────────────────────────────────────────────────────────

const ComponentRow = ({
  component,
  selectedDigest,
  onSelect,
  depth = 0,
  section,
  position,
  hadQuery,
}: {
  component: ComponentReference;
  selectedDigest?: string;
  onSelect: (c: ComponentReference) => void;
  depth?: number;
  section: ComponentRowSection;
  position: number;
  hadQuery: boolean;
}) => (
  <button
    onClick={() => onSelect(component)}
    style={{ paddingLeft: `${depth * 12 + 12}px` }}
    className={cn(
      "w-full text-left pr-3 py-1.5 border-b border-border/50 hover:bg-muted/50 flex flex-col gap-0 cursor-pointer",
      selectedDigest === component.digest && "bg-muted",
    )}
    {...tracking("component_library.row", {
      ...componentMetadata(component, section),
      surface: "dashboard",
      section,
      result_position: position,
      had_query: hadQuery,
    })}
  >
    <Text size="xs" className="truncate">
      {component.name ?? getComponentName(component)}
    </Text>
    {component.published_by && (
      <Text
        size="xs"
        className="text-muted-foreground/70 truncate leading-tight"
      >
        {component.published_by}
      </Text>
    )}
  </button>
);

// ─── Folder node (recursive, for library tree) ───────────────────────────────

const FolderNode = ({
  folder,
  depth,
  selectedDigest,
  onSelect,
  hadQuery,
}: {
  folder: ComponentFolder;
  depth: number;
  selectedDigest?: string;
  onSelect: (c: ComponentReference) => void;
  hadQuery: boolean;
}) => (
  <Collapsible defaultOpen>
    <CollapsibleTrigger
      aria-label={`${folder.name} folder`}
      style={{ paddingLeft: `${depth * 12 + 12}px` }}
      className="group w-full flex items-center gap-1.5 pr-3 py-0.5 border-b border-border/50 bg-muted/10 hover:bg-muted/30 cursor-pointer text-left"
    >
      <Icon
        name="ChevronRight"
        className="text-muted-foreground transition-transform shrink-0 group-data-[state=open]:rotate-90"
        size="sm"
      />
      <Text size="xs" className="text-muted-foreground font-medium truncate">
        {folder.name}
      </Text>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {folder.components?.map((c, i) => (
        <ComponentRow
          key={c.digest ?? c.url ?? c.name}
          component={c}
          selectedDigest={selectedDigest}
          onSelect={onSelect}
          depth={depth + 1}
          section="library"
          position={i}
          hadQuery={hadQuery}
        />
      ))}
      {folder.folders?.map((sub) => (
        <FolderNode
          key={sub.name}
          folder={sub}
          depth={depth + 1}
          selectedDigest={selectedDigest}
          onSelect={onSelect}
          hadQuery={hadQuery}
        />
      ))}
    </CollapsibleContent>
  </Collapsible>
);

// ─── Component List ─────────────────────────────────────────────────────────

const ComponentList = ({
  query,
  selectedDigest,
  onSelect,
}: {
  query: string;
  selectedDigest?: string;
  onSelect: (component: ComponentReference) => void;
}) => {
  const { backendUrl, configured, available, ready } = useBackend();
  const { track } = useAnalytics();

  // User components — IndexedDB, no backend needed
  const { data: userFolder } = useQuery({
    queryKey: ["userComponents"],
    queryFn: fetchUserComponents,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Static library — fetched from a remote YAML, same as editor sidebar
  const { data: componentLibrary } = useQuery({
    queryKey: ["componentLibrary"],
    queryFn: fetchAndStoreComponentLibrary,
    staleTime: 1000 * 60 * 60,
  });

  // Published components — from the backend API
  const { data: publishedData, isLoading: publishedLoading } =
    useQuery<ListPublishedComponentsResponse>({
      queryKey: ["published-components", backendUrl],
      refetchOnWindowFocus: false,
      enabled: configured && available,
      queryFn: async () => {
        const url = new URL(PUBLISHED_COMPONENTS_URL, backendUrl);
        return fetchWithErrorHandling(url.toString());
      },
    });

  const q = query.trim().toLowerCase();
  const hadQuery = q.length > 0;

  const matches = (name?: string | null, author?: string | null) =>
    !q || name?.toLowerCase().includes(q) || author?.toLowerCase().includes(q);

  const userComponents = (userFolder?.components ?? []).filter((c) =>
    matches(c.name, c.published_by),
  );

  const allLibraryComponents = componentLibrary
    ? flattenFolders(componentLibrary)
    : [];
  const filteredLibraryComponents = allLibraryComponents.filter((c) =>
    matches(c.name, c.published_by),
  );

  const publishedComponents = (publishedData?.published_components ?? [])
    .filter((c) => matches(c.name, c.published_by))
    .map(
      (c): ComponentReference => ({
        digest: c.digest,
        url: c.url ?? `${backendUrl}/api/components/${c.digest}`,
        name: c.name ?? undefined,
        published_by: c.published_by,
      }),
    );

  const total =
    userComponents.length +
    filteredLibraryComponents.length +
    publishedComponents.length;

  useEffect(() => {
    if (!ready || publishedLoading || q.length === 0) return;
    const timeoutId = setTimeout(() => {
      track("component_library.search.query", {
        query_length: q.length,
        result_count: total,
        surface: "dashboard",
        search_backend: "frontend_title",
      });
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [q, total, ready, publishedLoading, track]);

  if (!ready || publishedLoading) {
    return (
      <BlockStack gap="2" className="p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </BlockStack>
    );
  }

  if (total === 0) {
    return (
      <div className="px-4 py-3">
        <Paragraph tone="subdued" size="sm">
          {q ? "No components match your search." : "No components found."}
        </Paragraph>
      </div>
    );
  }

  return (
    <>
      {userComponents.length > 0 && (
        <CollapsibleSection
          label="User Components"
          count={userComponents.length}
        >
          {userComponents.map((c, i) => (
            <ComponentRow
              key={c.digest ?? c.url ?? c.name}
              component={c}
              selectedDigest={selectedDigest}
              onSelect={onSelect}
              section="user"
              position={i}
              hadQuery={hadQuery}
            />
          ))}
        </CollapsibleSection>
      )}

      {filteredLibraryComponents.length > 0 && componentLibrary && (
        <CollapsibleSection
          label="Library Components"
          count={filteredLibraryComponents.length}
        >
          {q
            ? // When searching, show a flat filtered list
              filteredLibraryComponents.map((c, i) => (
                <ComponentRow
                  key={c.digest ?? c.url ?? c.name}
                  component={c}
                  selectedDigest={selectedDigest}
                  onSelect={onSelect}
                  section="library"
                  position={i}
                  hadQuery={hadQuery}
                />
              ))
            : // When not searching, show the folder tree
              componentLibrary.folders.map((folder) => (
                <FolderNode
                  key={folder.name}
                  folder={folder}
                  depth={0}
                  selectedDigest={selectedDigest}
                  onSelect={onSelect}
                  hadQuery={hadQuery}
                />
              ))}
        </CollapsibleSection>
      )}

      {publishedComponents.length > 0 && (
        <CollapsibleSection
          label="Published Components"
          count={publishedComponents.length}
        >
          {publishedComponents.map((c, i) => (
            <ComponentRow
              key={c.digest}
              component={c}
              selectedDigest={selectedDigest}
              onSelect={onSelect}
              section="published"
              position={i}
              hadQuery={hadQuery}
            />
          ))}
        </CollapsibleSection>
      )}
    </>
  );
};

// ─── Main View ──────────────────────────────────────────────────────────────

export function DashboardComponentsView() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { backendUrl } = useBackend();
  // useSearch strict:false is required here — this route has no validateSearch defined
  const selectedDigest = readSelectedComponentDigest(
    useSearch({ strict: false }),
  );
  const handleSelect = (component: ComponentReference) => {
    navigate({
      to: APP_ROUTES.DASHBOARD_COMPONENTS,
      search: { component: component.digest },
    });
  };

  return (
    <div
      className="flex -mt-4 -mb-6 -mx-8 overflow-hidden border-t border-border"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      {/* Left: component list */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border shrink-0">
          <Input
            placeholder="Search components..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ComponentList
            query={query}
            selectedDigest={selectedDigest}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Right: detail panel — single scroll, source sticky on right */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {selectedDigest ? (
          <SuspenseWrapper fallback={<ComponentDetailSkeleton />}>
            <ComponentDetail
              reference={{
                digest: selectedDigest,
                url: `${backendUrl}/api/components/${selectedDigest}`,
              }}
            />
          </SuspenseWrapper>
        ) : (
          <InlineStack fill>
            <Paragraph tone="subdued" size="sm">
              Select a component to view its details.
            </Paragraph>
          </InlineStack>
        )}
      </div>
    </div>
  );
}
