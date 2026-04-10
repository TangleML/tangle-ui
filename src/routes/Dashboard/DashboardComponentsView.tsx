import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import type { ListPublishedComponentsResponse } from "@/api/types.gen";
import { CodeViewer } from "@/components/shared/CodeViewer";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { GithubDetails } from "@/components/shared/TaskDetails/GithubDetails";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchUserComponents,
  flattenFolders,
} from "@/providers/ComponentLibraryProvider/componentLibrary";
import { APP_ROUTES } from "@/routes/router";
import { fetchAndStoreComponentLibrary } from "@/services/componentService";
import type { ComponentFolder } from "@/types/componentLibrary";
import type {
  ComponentReference,
  InputSpec,
  OutputSpec,
} from "@/utils/componentSpec";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import { getComponentName } from "@/utils/getComponentName";

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
  children: React.ReactNode;
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
}: {
  component: ComponentReference;
  selectedDigest?: string;
  onSelect: (c: ComponentReference) => void;
  depth?: number;
}) => (
  <button
    onClick={() => onSelect(component)}
    style={{ paddingLeft: `${depth * 12 + 12}px` }}
    className={cn(
      "w-full text-left pr-3 py-1.5 border-b border-border/50 hover:bg-muted/50 flex flex-col gap-0 cursor-pointer",
      selectedDigest === component.digest && "bg-muted",
    )}
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
}: {
  folder: ComponentFolder;
  depth: number;
  selectedDigest?: string;
  onSelect: (c: ComponentReference) => void;
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
      {folder.components?.map((c) => (
        <ComponentRow
          key={c.digest ?? c.url ?? c.name}
          component={c}
          selectedDigest={selectedDigest}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
      {folder.folders?.map((sub) => (
        <FolderNode
          key={sub.name}
          folder={sub}
          depth={depth + 1}
          selectedDigest={selectedDigest}
          onSelect={onSelect}
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

  if (!ready || publishedLoading) {
    return (
      <BlockStack gap="2" className="p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </BlockStack>
    );
  }

  const q = query.trim().toLowerCase();

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
          {userComponents.map((c) => (
            <ComponentRow
              key={c.digest ?? c.url ?? c.name}
              component={c}
              selectedDigest={selectedDigest}
              onSelect={onSelect}
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
              filteredLibraryComponents.map((c) => (
                <ComponentRow
                  key={c.digest ?? c.url ?? c.name}
                  component={c}
                  selectedDigest={selectedDigest}
                  onSelect={onSelect}
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
                />
              ))}
        </CollapsibleSection>
      )}

      {publishedComponents.length > 0 && (
        <CollapsibleSection
          label="Published Components"
          count={publishedComponents.length}
        >
          {publishedComponents.map((c) => (
            <ComponentRow
              key={c.digest}
              component={c}
              selectedDigest={selectedDigest}
              onSelect={onSelect}
            />
          ))}
        </CollapsibleSection>
      )}
    </>
  );
};

// ─── Compact I/O table ───────────────────────────────────────────────────────

const IORow = ({
  name,
  type,
  required,
  defaultValue,
  description,
}: {
  name: string;
  type?: unknown;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
}) => (
  <div className="grid grid-cols-[1fr_auto_auto] items-start gap-x-3 gap-y-0.5 px-3 py-2 border-b border-border/50 last:border-0">
    <div className="flex flex-col gap-0.5 min-w-0">
      <Text size="xs" weight="semibold" className="truncate font-mono">
        {name}
      </Text>
      {description && (
        <Text size="xs" className="text-muted-foreground leading-snug">
          {description}
        </Text>
      )}
      {defaultValue !== undefined && (
        <Text size="xs" className="text-muted-foreground">
          Default: <span className="font-mono">{String(defaultValue)}</span>
        </Text>
      )}
    </div>
    <Text size="xs" className="text-muted-foreground shrink-0 pt-0.5">
      {type ? String(type) : "—"}
    </Text>
    <Badge
      className={cn(
        "shrink-0 mt-0.5 text-[10px] font-semibold leading-none",
        required
          ? "bg-rose-100 text-rose-700 hover:bg-rose-100"
          : "bg-muted text-muted-foreground hover:bg-muted",
      )}
    >
      {required ? "req" : "opt"}
    </Badge>
  </div>
);

const CompactIO = ({
  inputs,
  outputs,
}: {
  inputs?: InputSpec[];
  outputs?: OutputSpec[];
}) => (
  <BlockStack gap="3">
    {inputs && inputs.length > 0 && (
      <div>
        <Text
          size="xs"
          className="text-muted-foreground font-medium uppercase tracking-wide px-1 mb-1"
        >
          Inputs
        </Text>
        <div className="border border-border rounded-md overflow-hidden">
          {inputs.map((input) => (
            <IORow
              key={input.name}
              name={input.name}
              type={input.type}
              required={!input.optional}
              defaultValue={input.default}
              description={input.description}
            />
          ))}
        </div>
      </div>
    )}
    {outputs && outputs.length > 0 && (
      <div>
        <Text
          size="xs"
          className="text-muted-foreground font-medium uppercase tracking-wide px-1 mb-1"
        >
          Outputs
        </Text>
        <div className="border border-border rounded-md overflow-hidden">
          {outputs.map((output) => (
            <IORow
              key={output.name}
              name={output.name}
              type={output.type}
              description={output.description}
            />
          ))}
        </div>
      </div>
    )}
  </BlockStack>
);

// ─── Detail Panel (Suspense) ────────────────────────────────────────────────

const ComponentDetailInner = ({ digest }: { digest: string }) => {
  const { backendUrl } = useBackend();
  const componentRef: ComponentReference = {
    digest,
    url: `${backendUrl}/api/components/${digest}`,
  };
  const hydrated = useHydrateComponentReference(componentRef);

  if (!hydrated?.spec) {
    return (
      <Paragraph tone="subdued" size="sm">
        Could not load component details.
      </Paragraph>
    );
  }

  const { spec } = hydrated;
  const annotations = spec.metadata?.annotations ?? {};
  const author =
    typeof annotations.author === "string" ? annotations.author : undefined;
  const canonicalUrl =
    typeof annotations.canonical_location === "string"
      ? annotations.canonical_location
      : undefined;
  const gitRemoteUrl =
    typeof annotations.git_remote_url === "string"
      ? annotations.git_remote_url
      : undefined;
  const gitRemoteBranch =
    typeof annotations.git_remote_branch === "string"
      ? annotations.git_remote_branch
      : undefined;
  const gitRelativeDir =
    typeof annotations.git_relative_dir === "string"
      ? annotations.git_relative_dir
      : undefined;
  const componentYamlPath =
    typeof annotations.component_yaml_path === "string"
      ? annotations.component_yaml_path
      : undefined;
  const documentationPath =
    typeof annotations.documentation_path === "string"
      ? annotations.documentation_path
      : undefined;

  let reconstructedUrl: string | undefined;
  let documentationUrl: string | undefined;

  if (gitRemoteUrl && gitRemoteBranch && gitRelativeDir) {
    const repoPath = gitRemoteUrl
      .replace(/^https:\/\/github\.com\//, "")
      .replace(/\.git$/, "");
    const buildGitHubUrl = (filePath: string) =>
      `https://github.com/${repoPath}/blob/${gitRemoteBranch}/${gitRelativeDir}/${filePath}`;
    if (!hydrated.url && componentYamlPath)
      reconstructedUrl = buildGitHubUrl(componentYamlPath);
    if (documentationPath) documentationUrl = buildGitHubUrl(documentationPath);
  }

  const hasIO =
    (spec.inputs && spec.inputs.length > 0) ||
    (spec.outputs && spec.outputs.length > 0);

  return (
    // Side-by-side layout: info+IO on left, source code sticky on right
    <InlineStack gap="6" blockAlign="start">
      {/* Left: metadata + I/O — flows naturally with the page scroll */}
      <div className="flex-2 min-w-0 flex flex-col gap-4">
        {/* Header */}
        <BlockStack gap="1">
          <Heading level={2}>{spec.name ?? digest}</Heading>
          {author && (
            <Text size="sm" className="text-muted-foreground">
              {author}
            </Text>
          )}
          {hydrated.digest && (
            <Badge
              variant="outline"
              className="font-mono text-xs min-w-0 max-w-full overflow-hidden"
            >
              <CopyText size="xs" className="font-mono truncate">
                {hydrated.digest}
              </CopyText>
            </Badge>
          )}
        </BlockStack>

        {spec.description && (
          <Paragraph size="sm" tone="subdued">
            {spec.description}
          </Paragraph>
        )}

        <GithubDetails
          url={hydrated.url ?? reconstructedUrl}
          canonicalUrl={canonicalUrl}
          documentationUrl={documentationUrl}
        />

        {hasIO && <CompactIO inputs={spec.inputs} outputs={spec.outputs} />}
      </div>

      {/* Right: source code — sticky so it stays in view while left side scrolls */}
      {hydrated.text && (
        <div className="flex-3 min-w-0">
          <div
            className="sticky top-0 flex flex-col gap-1.5"
            style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT + 48}px)` }}
          >
            <Text
              size="xs"
              className="text-muted-foreground font-medium uppercase tracking-wide shrink-0"
            >
              Source
            </Text>
            <div className="flex-1 min-h-0">
              <CodeViewer
                code={hydrated.text}
                language="yaml"
                filename={spec.name ?? "component.yaml"}
              />
            </div>
          </div>
        </div>
      )}
    </InlineStack>
  );
};

// ─── Main View ──────────────────────────────────────────────────────────────

export function DashboardComponentsView() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  // useSearch strict:false is required here — this route has no validateSearch defined
  const { component: selectedDigest } = useSearch({ strict: false }) as {
    component?: string;
  };
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
          <SuspenseWrapper
            fallback={
              <InlineStack gap="6">
                <div className="flex-1 flex flex-col gap-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="flex-3 min-w-0 h-64" />
              </InlineStack>
            }
          >
            <ComponentDetailInner digest={selectedDigest} />
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
