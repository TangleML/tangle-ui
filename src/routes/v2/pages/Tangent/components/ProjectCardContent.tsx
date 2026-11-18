import { observer } from "mobx-react-lite";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListItem, type ListItemAction } from "@/components/ui/list-item";
import { Heading, Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useArchivedProjectItems } from "@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems";
import { useOpenWorkareaTarget } from "@/routes/v2/pages/Tangent/hooks/useOpenWorkareaTarget";
import { useProjectResourceItems } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import {
  type ProjectFile,
  useProjectSessionFiles,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessionFiles";
import { ASSET_LIMIT } from "@/routes/v2/pages/Tangent/services/chatCommandResults";
import {
  type ProjectCardItem,
  projectCardLists,
  type ProjectCardRepository,
  type ProjectCardRun,
} from "@/routes/v2/pages/Tangent/services/projectCardEntries";
import { fileIcon } from "@/routes/v2/pages/Tangent/services/projectFiles";
import { ago } from "@/routes/v2/pages/Tangent/services/relativeTime";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { runTarget } from "@/services/projects/resourceTarget";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { containsSearchTerm } from "@/utils/searchUtils";
import { tracking } from "@/utils/tracking";
import { getStorage } from "@/utils/typedStorage";

import { type AddableKind, AddResourceButton } from "./AddResourceButton";
import { RunListItem } from "./RunListItem";
import { SearchField } from "./SearchField";

type CardView = "main" | "files" | "archived";

const PREVIEW_COUNT = ASSET_LIMIT;

const EXPANDED_KEY = "tangent-card-expanded-sections";

const storage = getStorage<
  typeof EXPANDED_KEY,
  { [EXPANDED_KEY]: Record<string, string[]> }
>();

function split<T extends { archived: boolean }>(items: T[]) {
  return {
    active: items.filter(({ archived }) => !archived),
    archived: items.filter(({ archived }) => archived),
  };
}

const matching = (query: string, ...texts: string[]) =>
  texts.some((text) => containsSearchTerm(text, query));

/**
 * What the project holds, in the order someone looks for it: reports (the
 * files pinned as ready to share), its latest runs, its pipelines, the
 * repositories it links, and its documents. Each shows its newest few and the
 * rest on "Show all", which is remembered per project; reports leave the rest
 * to "All files", where every file the chats made waits, with its own search,
 * to be pinned or unpinned. One search filters the card, showing every match,
 * and a section with nothing to show drops out.
 */
export const ProjectCardContent = observer(function ProjectCardContent() {
  // The card stays mounted when another project is opened in place; its
  // search and sub-view belong to the project they were used in.
  const { projectId } = useTangentProject();
  return <ProjectCardBody key={projectId} />;
});

const ProjectCardBody = observer(function ProjectCardBody() {
  const store = useTangentProject();
  const dismissCard = useOptionalWindowContext()?.dismissFlyout;
  const openTarget = useOpenWorkareaTarget({ onOpenBesideChat: dismissCard });
  const searchRef = useRef<HTMLInputElement>(null);
  const focusRequested = store.searchFocusRequested;
  useEffect(() => {
    if (!focusRequested) return;
    searchRef.current?.focus();
    store.clearSearchFocusRequest();
  }, [focusRequested, store]);
  const [query, setQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [view, setView] = useState<CardView>("main");
  const [expandedByProject, setExpandedByProject] = useState(
    () => storage.getItem(EXPANDED_KEY) ?? {},
  );
  const resourceItems = useProjectResourceItems(store.projectId);
  const { resources, summaries } = resourceItems;
  const projectRuns = useProjectRuns(store.projectId);
  const files = useProjectSessionFiles(store.projectId);
  const { archived, archive, restore } = useArchivedProjectItems(
    store.projectId,
  );

  const searching = query.trim() !== "";
  const matches = (...texts: string[]) =>
    !searching || matching(query, ...texts);

  const lists = projectCardLists({
    items: resources,
    summaries,
    projectRuns: projectRuns.data ?? [],
    archived,
  });
  const pipelines = split(lists.pipelines);
  const repositories = split(lists.repositories);
  const documents = split(lists.documents);
  const runs = split(lists.runs);
  const fileMatches = ({ title, path }: ProjectFile) => matches(title, path);

  function openFile(file: ProjectFile) {
    dismissCard?.();
    store.openArtifactTab(file.url, file.title);
  }

  function archiveAction(key: string, name: string): ListItemAction {
    return view === "archived"
      ? {
          icon: "Undo2",
          label: `Restore ${name}`,
          onClick: () => restore(key),
          tracking: tracking("projects.project_card.restore"),
        }
      : {
          icon: "Archive",
          label: `Archive ${name}`,
          onClick: () => archive(key),
          tracking: tracking("projects.project_card.archive"),
        };
  }

  function renderFile(file: ProjectFile, markPinned = false) {
    return (
      <ListItem
        key={file.key}
        icon={fileIcon(file.path)}
        title={file.title}
        subtitle={ago(file.addedAt)}
        flair={
          markPinned && file.pinned
            ? { kind: "icon", icon: "Pin", label: "Pinned to reports" }
            : undefined
        }
        onOpen={() => openFile(file)}
        tracking={tracking("projects.project_card.open_file")}
        actions={[
          file.pinned
            ? {
                icon: "PinOff",
                label: `Unpin ${file.title} from reports`,
                onClick: () => files.unpin(file),
                tracking: tracking("projects.project_card.unpin_report"),
              }
            : {
                icon: "Pin",
                label: `Pin ${file.title} to reports`,
                onClick: () => files.pin(file),
                tracking: tracking("projects.project_card.pin_report"),
              },
        ]}
      />
    );
  }

  function renderRun(run: ProjectCardRun) {
    return (
      <RunListItem
        key={run.id}
        runId={run.id}
        name={run.pipelineName}
        at={run.ranAt}
        action={archiveAction(run.key, run.pipelineName)}
        onOpen={(event) =>
          void openTarget(runTarget(run.id), run.pipelineName, event)
        }
        trackingId="projects.project_card.open_run"
      />
    );
  }

  function renderAttached(item: ProjectCardItem) {
    const isPipeline = item.target.type === "pipeline";
    const added = ago(item.addedAt);
    return (
      <ListItem
        key={item.id}
        icon={item.icon}
        title={item.name}
        subtitle={added && `Added ${added}`}
        onOpen={() => void openTarget(item.target, item.name)}
        tracking={tracking(
          isPipeline
            ? "projects.project_card.open_pipeline"
            : "projects.project_card.open_document",
        )}
        actions={[archiveAction(item.key, item.name)]}
      />
    );
  }

  function renderRepository(item: ProjectCardRepository) {
    const added = ago(item.addedAt);
    const opening =
      item.repository.url === undefined
        ? { disabled: true as const }
        : { href: item.repository.url };
    return (
      <ListItem
        key={item.id}
        icon={item.icon}
        title={item.name}
        subtitle={added && `Added ${added}`}
        {...opening}
        tracking={tracking("projects.open_repository", {
          surface: "project_card",
        })}
        actions={[archiveAction(item.key, item.name)]}
      />
    );
  }

  const add = (kind: AddableKind) => (
    <AddResourceButton
      projectId={store.projectId}
      resources={summaries}
      kind={kind}
      disabled={!resourceItems.isLoaded}
    />
  );
  const back = () => setView("main");

  if (view === "files") {
    const shownFiles = files.files.filter(({ title, path }) =>
      matching(fileQuery, title, path),
    );
    return (
      <SubView title="All files" count={files.files.length} onBack={back}>
        <div className="px-2">
          <SearchField
            value={fileQuery}
            onChange={setFileQuery}
            label="Search all files"
            trackingPrefix="projects.project_card.all_files"
            inputRef={searchRef}
          />
        </div>
        {shownFiles.length === 0 ? (
          <EmptyNote>
            {files.files.length === 0
              ? emptyNote(
                  [files],
                  "this project's files",
                  "The chats in this project haven't made any files yet",
                )
              : "No files match"}
          </EmptyNote>
        ) : (
          <BlockStack as="ul" align="stretch" className="p-2">
            {shownFiles.map((file) => renderFile(file, true))}
          </BlockStack>
        )}
      </SubView>
    );
  }

  const archivedSections: Section[] = [
    { title: "Runs", rows: runs.archived.map(renderRun) },
    { title: "Pipelines", rows: pipelines.archived.map(renderAttached) },
    {
      title: "Repositories",
      rows: repositories.archived.map(renderRepository),
    },
    { title: "Documents", rows: documents.archived.map(renderAttached) },
  ].filter(({ rows }) => rows.length > 0);
  const archivedCount = archivedSections.reduce(
    (total, { rows }) => total + rows.length,
    0,
  );

  if (view === "archived") {
    return (
      <SubView title="Archived" count={archivedCount} onBack={back}>
        {archivedSections.length === 0 ? (
          <EmptyNote>Nothing is archived</EmptyNote>
        ) : (
          <CardSections sections={archivedSections} />
        )}
      </SubView>
    );
  }

  const remembered = expandedByProject[store.projectId];
  const expanded = new Set(Array.isArray(remembered) ? remembered : []);
  function rememberExpanded(titles: ReadonlySet<string>) {
    const all = { ...expandedByProject, [store.projectId]: [...titles] };
    setExpandedByProject(all);
    storage.setItem(EXPANDED_KEY, all);
  }
  function toggleSection(title: string) {
    const next = new Set(expanded);
    if (!next.delete(title)) next.add(title);
    rememberExpanded(next);
  }
  function expandSection(title: string) {
    rememberExpanded(new Set(expanded).add(title));
  }
  const overflowUnlessSearching = (overflow: Overflow) =>
    searching ? undefined : overflow;

  const sections: (Section & { shownWhenEmpty: boolean })[] = [
    {
      title: "Reports",
      rows: files.reports.filter(fileMatches).map((file) => renderFile(file)),
      empty: emptyNote(
        [files],
        "this project's reports",
        "Nothing has been pinned as a report yet",
      ),
      overflow: overflowUnlessSearching("footer"),
      footer: searching ? undefined : (
        <FooterButton
          icon="Files"
          label="All files"
          count={files.files.length}
          onClick={() => setView("files")}
          trackingId="projects.project_card.all_files"
        />
      ),
      shownWhenEmpty: true,
    },
    {
      title: "Other files",
      rows: searching
        ? files.files
            .filter((file) => !file.pinned && fileMatches(file))
            .map((file) => renderFile(file))
        : [],
      shownWhenEmpty: false,
    },
    {
      title: "Runs",
      rows: runs.active
        .filter(({ pipelineName }) => matches(pipelineName))
        .map(renderRun),
      afterAllRows: searching ? undefined : (
        <LoadOlderRuns
          query={projectRuns}
          onLoad={() => expandSection("Runs")}
        />
      ),
      overflow: overflowUnlessSearching("show-all"),
      action: add("run"),
      empty: projectRuns.hasNextPage
        ? undefined
        : emptyNote(
            [projectRuns, resourceItems],
            "this project's runs",
            "Nothing has been run yet",
          ),
      shownWhenEmpty: true,
    },
    {
      title: "Pipelines",
      rows: pipelines.active
        .filter(({ name }) => matches(name))
        .map(renderAttached),
      overflow: overflowUnlessSearching("show-all"),
      action: add("pipeline"),
      empty: emptyNote(
        [resourceItems],
        "this project's pipelines",
        "No pipelines yet",
      ),
      shownWhenEmpty: true,
    },
    {
      title: "Repositories",
      rows: repositories.active
        .filter(({ name }) => matches(name))
        .map(renderRepository),
      overflow: overflowUnlessSearching("show-all"),
      action: add("repository"),
      empty: emptyNote(
        [resourceItems],
        "this project's repositories",
        "No repositories linked yet",
      ),
      shownWhenEmpty: true,
    },
    {
      title: "Documents",
      rows: documents.active
        .filter(({ name }) => matches(name))
        .map(renderAttached),
      overflow: overflowUnlessSearching("show-all"),
      action: add("document"),
      empty: emptyNote(
        [resourceItems],
        "this project's documents",
        "No documents yet",
      ),
      shownWhenEmpty: true,
    },
  ];
  const shownSections = sections.filter(
    ({ rows, shownWhenEmpty }) =>
      rows.length > 0 || (shownWhenEmpty && !searching),
  );

  return (
    <BlockStack align="stretch">
      <div className="p-2 pb-0">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search this project"
          trackingPrefix="projects.project_card"
          inputRef={searchRef}
        />
      </div>
      {searching && shownSections.length === 0 && (
        <EmptyNote>Nothing in this project matches</EmptyNote>
      )}
      <CardSections
        sections={shownSections}
        expanded={expanded}
        onToggle={toggleSection}
      />
      {archivedCount > 0 && !searching && (
        <div className="border-t border-border p-2">
          <FooterButton
            icon="Archive"
            label="Show archived"
            count={archivedCount}
            onClick={() => setView("archived")}
            trackingId="projects.project_card.show_archived"
          />
        </div>
      )}
    </BlockStack>
  );
});

/** An empty section that is still loading, or failed to, says so instead. */
function emptyNote(
  sources: { isLoading: boolean; error: unknown }[],
  what: string,
  none: string,
): string {
  if (sources.some(({ error }) => error)) return `Couldn't load ${what}`;
  if (sources.some(({ isLoading }) => isLoading)) return "Loading…";
  return none;
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" tone="subdued" className="px-4 py-3">
      {children}
    </Text>
  );
}

function SubView({
  title,
  count,
  onBack,
  children,
}: {
  title: string;
  count: number;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <BlockStack align="stretch">
      <InlineStack gap="1" wrap="nowrap" className="min-h-11 px-2 pt-2">
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label="Back"
          title="Back"
          onClick={onBack}
          {...tracking("projects.project_card.back")}
        >
          <Icon name="ChevronLeft" size="sm" />
        </Button>
        <Heading level={3} size="xs" weight="medium">
          {title}
        </Heading>
        <Text size="xs" tone="subdued">
          {count}
        </Text>
      </InlineStack>
      {children}
    </BlockStack>
  );
}

function FooterButton({
  icon,
  label,
  count,
  onClick,
  trackingId,
}: {
  icon: "Archive" | "Files";
  label: string;
  count: number;
  onClick: () => void;
  trackingId: string;
}) {
  return (
    <Button
      variant="subtle"
      size="row"
      align="start"
      fullWidth
      onClick={onClick}
      {...tracking(trackingId)}
    >
      <Icon name={icon} size="sm" />
      {label}
      <Text size="xs" tone="inherit" className="ms-auto">
        {count}
      </Text>
    </Button>
  );
}

type Overflow = "show-all" | "footer";

interface Section {
  title: string;
  rows: ReactNode[];
  afterAllRows?: ReactNode;
  overflow?: Overflow;
  action?: ReactNode;
  empty?: string;
  footer?: ReactNode;
}

function CardSections({
  sections,
  expanded = new Set(),
  onToggle,
}: {
  sections: Section[];
  expanded?: ReadonlySet<string>;
  onToggle?: (title: string) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {sections.map(({ title, rows, afterAllRows, overflow, ...section }) => {
        const long = overflow !== undefined && rows.length > PREVIEW_COUNT;
        const open = expanded.has(title);
        const clipped = long && !(overflow === "show-all" && open);
        return (
          <CardSection
            key={title}
            title={title}
            count={rows.length}
            {...section}
          >
            {clipped ? rows.slice(0, PREVIEW_COUNT) : rows}
            {!clipped && afterAllRows}
            {long && overflow === "show-all" && (
              <ShowAllRow
                open={open}
                total={rows.length}
                title={title}
                onToggle={() => onToggle?.(title)}
              />
            )}
          </CardSection>
        );
      })}
    </div>
  );
}

function ShowAllRow({
  open,
  total,
  title,
  onToggle,
}: {
  open: boolean;
  total: number;
  title: string;
  onToggle: () => void;
}) {
  return (
    <li>
      <Button
        variant="subtle"
        size="row"
        align="start"
        fullWidth
        aria-expanded={open}
        onClick={onToggle}
        className="ps-8"
        {...tracking(
          open
            ? "projects.project_card.show_fewer"
            : "projects.project_card.show_all",
          { section: title },
        )}
      >
        {open ? "Show fewer" : `Show all ${total}`}
      </Button>
    </li>
  );
}

/** Every row shows; the card's column or popover scrolls, not the section. */
function CardSection({
  title,
  count,
  action,
  empty,
  footer,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  empty?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-0.5 p-2">
      <InlineStack align="space-between" wrap="nowrap" className="min-h-6 px-2">
        <InlineStack gap="2" wrap="nowrap">
          <Heading level={3} size="xs" weight="medium" tone="subdued">
            {title}
          </Heading>
          {count > 0 && (
            <Text size="xs" tone="subdued">
              {count}
            </Text>
          )}
        </InlineStack>
        {action}
      </InlineStack>
      {count === 0 && empty ? (
        <Text size="xs" tone="subdued" className="px-2 py-1">
          {empty}
        </Text>
      ) : (
        <BlockStack as="ul" align="stretch">
          {children}
        </BlockStack>
      )}
      {footer}
    </section>
  );
}

function LoadOlderRuns({
  query,
  onLoad,
}: {
  query: ReturnType<typeof useProjectRuns>;
  onLoad: () => void;
}) {
  if (!query.hasNextPage) return null;
  return (
    <li>
      <Button
        variant="subtle"
        size="row"
        align="start"
        fullWidth
        disabled={query.isFetchingNextPage}
        onClick={() => {
          onLoad();
          void query.fetchNextPage();
        }}
        className="ps-8"
        {...tracking("projects.project_card.load_older_runs")}
      >
        {query.isFetchingNextPage ? "Loading…" : "Load older runs"}
      </Button>
    </li>
  );
}
