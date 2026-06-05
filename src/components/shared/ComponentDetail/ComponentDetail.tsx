import type { ReactNode } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { GithubDetails } from "@/components/shared/TaskDetails/GithubDetails";
import { Badge } from "@/components/ui/badge";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import { cn } from "@/lib/utils";
import type {
  ComponentReference,
  InputSpec,
  OutputSpec,
} from "@/utils/componentSpec";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { getComponentName } from "@/utils/getComponentName";
import { buildComponentSourceUrl } from "@/utils/URL";

// Repeated label style used for "Inputs"/"Outputs"/"Source" headings — small,
// subdued, uppercase. Extracted so the three call sites stay in sync.
const SectionLabel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <Text
    size="xs"
    tone="subdued"
    weight="semibold"
    className={cn("uppercase tracking-wide", className)}
  >
    {children}
  </Text>
);

// ─── Compact I/O table ───────────────────────────────────────────────────────

// Minimal I/O row: name on the left, type+req/opt on the right, optional
// description on its own line. No box borders — a subtle divider between
// rows is enough to read as a list.
const IORow = ({
  name,
  type,
  required,
  defaultValue,
  description,
  isLast,
}: {
  name: string;
  type?: unknown;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  isLast?: boolean;
}) => (
  <div className={cn("py-2.5", !isLast && "border-b border-border/40")}>
    <InlineStack gap="3" blockAlign="center" wrap="nowrap">
      <Text
        size="sm"
        weight="semibold"
        font="mono"
        className="truncate min-w-0 flex-1"
      >
        {name}
      </Text>
      {!!type && (
        <Text size="xs" tone="subdued" className="shrink-0">
          {String(type)}
        </Text>
      )}
      <Text
        size="xs"
        weight="semibold"
        tone={required ? "critical" : "subdued"}
        className="shrink-0 uppercase tracking-wide"
      >
        {required ? "required" : "optional"}
      </Text>
    </InlineStack>
    {description && (
      <Text size="xs" tone="subdued" className="leading-snug block mt-0.5">
        {description}
      </Text>
    )}
    {defaultValue !== undefined && (
      <Text size="xs" tone="subdued" className="block mt-0.5">
        Default:{" "}
        <Text as="span" font="mono">
          {String(defaultValue)}
        </Text>
      </Text>
    )}
  </div>
);

const IOSection = ({
  label,
  rows,
}: {
  label: string;
  rows: ReadonlyArray<{
    name: string;
    type?: unknown;
    required?: boolean;
    defaultValue?: unknown;
    description?: string;
  }>;
}) => (
  <BlockStack gap="1" align="stretch">
    <SectionLabel>{label}</SectionLabel>
    <div>
      {rows.map((row, idx) => (
        <IORow
          key={row.name}
          name={row.name}
          type={row.type}
          required={row.required}
          defaultValue={row.defaultValue}
          description={row.description}
          isLast={idx === rows.length - 1}
        />
      ))}
    </div>
  </BlockStack>
);

const CompactIO = ({
  inputs,
  outputs,
}: {
  inputs?: InputSpec[];
  outputs?: OutputSpec[];
}) => (
  <BlockStack gap="5" align="stretch">
    {inputs && inputs.length > 0 && (
      <IOSection
        label="Inputs"
        rows={inputs.map((i) => ({
          name: i.name,
          type: i.type,
          required: !i.optional,
          defaultValue: i.default,
          description: i.description,
        }))}
      />
    )}
    {outputs && outputs.length > 0 && (
      <IOSection
        label="Outputs"
        rows={outputs.map((o) => ({
          name: o.name,
          type: o.type,
          description: o.description,
        }))}
      />
    )}
  </BlockStack>
);

// ─── Detail panel (suspends on hydration) ───────────────────────────────────

interface ComponentDetailProps {
  /**
   * The reference to render. Callers pass whatever they have — a hydrated ref
   * (no network needed) or a stub with `digest`+`url` (one hydration round-trip).
   * Hydration is keyed by digest/url, so cache is shared with other usages.
   */
  reference: ComponentReference;
  /**
   * - `split` (V1 default): metadata+I/O on the left, sticky source code panel
   *   on the right. Best for full-bleed detail pages.
   * - `stacked`: single column — metadata, I/O, then source code in a card with
   *   a capped height. Best for narrower detail panes alongside other content.
   */
  layout?: "split" | "stacked";
  /**
   * CSS height for the source code panel. In `split` layout this is the sticky
   * right column's height (defaults to the remaining viewport height under the
   * top nav). In `stacked` layout this caps the inline source card's height.
   */
  sourcePanelHeight?: string;
}

export const ComponentDetail = ({
  reference,
  layout = "split",
  sourcePanelHeight,
}: ComponentDetailProps) => {
  const hydrated = useHydrateComponentReference(reference);

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
    if (!hydrated.url && componentYamlPath) {
      reconstructedUrl = buildComponentSourceUrl({
        remoteUrl: gitRemoteUrl,
        branch: gitRemoteBranch,
        relativeDir: gitRelativeDir,
        filePath: componentYamlPath,
      });
    }
    if (documentationPath) {
      documentationUrl = buildComponentSourceUrl({
        remoteUrl: gitRemoteUrl,
        branch: gitRemoteBranch,
        relativeDir: gitRelativeDir,
        filePath: documentationPath,
      });
    }
  }

  const hasIO =
    (spec.inputs && spec.inputs.length > 0) ||
    (spec.outputs && spec.outputs.length > 0);

  // ── Shared sub-blocks ──────────────────────────────────────────────────
  const header = (
    <BlockStack gap="2">
      <Heading level={2}>{getComponentName(hydrated)}</Heading>
      {author && (
        <Text size="sm" tone="subdued">
          {author}
        </Text>
      )}
      {hydrated.digest && (
        <Badge
          variant="outline"
          className="font-mono text-xs min-w-0 max-w-full overflow-hidden self-start"
        >
          <CopyText size="xs" className="font-mono truncate">
            {hydrated.digest}
          </CopyText>
        </Badge>
      )}
    </BlockStack>
  );

  const description = spec.description && (
    // `[overflow-wrap:anywhere]` breaks at any character so long URLs/paths
    // wrap inside the pane. `break-words` is insufficient — it only breaks
    // at word boundaries, which doesn't help for URLs without spaces.
    <Paragraph size="sm" tone="subdued" className="[overflow-wrap:anywhere]">
      {spec.description}
    </Paragraph>
  );

  const githubLinks = (
    <GithubDetails
      url={hydrated.url ?? reconstructedUrl}
      canonicalUrl={canonicalUrl}
      documentationUrl={documentationUrl}
    />
  );

  const io = hasIO && <CompactIO inputs={spec.inputs} outputs={spec.outputs} />;

  // ── Stacked layout ────────────────────────────────────────────────────
  // Single column — metadata, links, I/O, then source. Wraps source in a
  // card so it's visually distinct from the rest and capped to a fixed
  // height to keep the page scannable in narrower containers.
  if (layout === "stacked") {
    const stackedSourceHeight = sourcePanelHeight ?? "60vh";
    return (
      <BlockStack gap="6" align="stretch">
        {header}
        {description}
        {githubLinks}
        {io}
        {hydrated.text && (
          <div
            style={{ height: stackedSourceHeight }}
            className="min-h-0 rounded-md overflow-hidden"
          >
            <CodeViewer
              code={hydrated.text}
              language="yaml"
              filename={spec.name ?? "component.yaml"}
            />
          </div>
        )}
      </BlockStack>
    );
  }

  // ── Split layout (V1 default) ─────────────────────────────────────────
  const splitSourceHeight =
    sourcePanelHeight ?? `calc(100vh - ${TOP_NAV_HEIGHT + 48}px)`;
  return (
    <InlineStack gap="6" blockAlign="start">
      <BlockStack gap="4" className="flex-2 min-w-0">
        {header}
        {description}
        {githubLinks}
        {io}
      </BlockStack>

      {hydrated.text && (
        <div className="flex-3 min-w-0">
          <div className="sticky top-0" style={{ height: splitSourceHeight }}>
            <BlockStack className="gap-1.5 h-full" align="stretch">
              <SectionLabel className="shrink-0">Source</SectionLabel>
              <div className="flex-1 min-h-0">
                <CodeViewer
                  code={hydrated.text}
                  language="yaml"
                  filename={spec.name ?? "component.yaml"}
                />
              </div>
            </BlockStack>
          </div>
        </div>
      )}
    </InlineStack>
  );
};

export const ComponentDetailSkeleton = () => (
  <InlineStack gap="6">
    <BlockStack gap="3" className="flex-1">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </BlockStack>
    <Skeleton className="flex-3 min-w-0 h-64" />
  </InlineStack>
);
