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
import {
  type ProjectCardItem,
  projectCardLists,
  type ProjectCardRun,
} from "@/routes/v2/pages/Tangent/services/projectCardEntries";
import { fileIcon } from "@/routes/v2/pages/Tangent/services/projectFiles";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { runTarget } from "@/services/projects/resourceTarget";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";
import { containsSearchTerm } from "@/utils/searchUtils";
import { tracking } from "@/utils/tracking";

import { AddResourceButton } from "./AddResourceButton";
import { RunListItem } from "./RunListItem";
import { SearchField } from "./SearchField";

type CardView = "main" | "files" | "archived";

function ago(date: Date | null | undefined): string | undefined {
  return date ? formatRelativeTime(date) : undefined;
}

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
 * files pinned as ready to share), its latest runs, its pipelines, and its
 * documents, each a short list that scrolls. Every file the chats made waits
 * behind "All files", with its own search, where any of them can be pinned or
 * unpinned. One search filters the card, and a section with nothing to show
 * drops out.
 */
export const ProjectCardContent = observer(function ProjectCardContent() {
  const store = useTangentProject();
  const dismissCard = useOptionalWindowContext()?.dismissFlyout;
  const openWorkareaTarget = useOpenWorkareaTarget();
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
  const documents = split(lists.documents);
  const runs = split(lists.runs);
  const fileMatches = ({ title, path }: ProjectFile) => matches(title, path);
  const openTarget: typeof openWorkareaTarget = (target, title, event) => {
    dismissCard?.();
    return openWorkareaTarget(target, title, event);
  };

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

  const add = (kind: "pipeline" | "run" | "document") => (
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
              ? "The chats in this project haven't made any files yet"
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

  // A section stays while it has rows, or, outside a search, while it's one
  // that always shows.
  const sections: (Section & { always: boolean })[] = [
    {
      title: "Reports",
      rows: files.reports.filter(fileMatches).map((file) => renderFile(file)),
      empty: "Nothing has been pinned as a report yet",
      footer: searching ? undefined : (
        <FooterButton
          icon="Files"
          label="All files"
          count={files.files.length}
          onClick={() => setView("files")}
          trackingId="projects.project_card.all_files"
        />
      ),
      always: files.files.length > 0,
    },
    {
      title: "Other files",
      rows: searching
        ? files.files
            .filter((file) => !file.pinned && fileMatches(file))
            .map((file) => renderFile(file))
        : [],
      always: false,
    },
    {
      title: "Runs",
      rows: runs.active
        .filter(({ pipelineName }) => matches(pipelineName))
        .map(renderRun),
      more: searching ? undefined : <LoadOlderRuns query={projectRuns} />,
      action: add("run"),
      empty: emptyNote(
        [projectRuns, resourceItems],
        "this project's runs",
        "Nothing has been run yet",
      ),
      always: true,
    },
    {
      title: "Pipelines",
      rows: pipelines.active
        .filter(({ name }) => matches(name))
        .map(renderAttached),
      action: add("pipeline"),
      empty: emptyNote(
        [resourceItems],
        "this project's pipelines",
        "No pipelines yet",
      ),
      always: true,
    },
    {
      title: "Documents",
      rows: documents.active
        .filter(({ name }) => matches(name))
        .map(renderAttached),
      action: add("document"),
      empty: emptyNote(
        [resourceItems],
        "this project's documents",
        "No documents yet",
      ),
      always: true,
    },
  ];
  const shownSections = sections.filter(
    ({ rows, always }) => rows.length > 0 || (always && !searching),
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
      <CardSections sections={shownSections} />
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

interface Section {
  title: string;
  rows: ReactNode[];
  more?: ReactNode;
  action?: ReactNode;
  empty?: string;
  footer?: ReactNode;
}

function CardSections({ sections }: { sections: Section[] }) {
  return (
    <div className="divide-y divide-border">
      {sections.map(({ title, rows, more, ...section }) => (
        <CardSection key={title} title={title} count={rows.length} {...section}>
          {rows}
          {more}
        </CardSection>
      ))}
    </div>
  );
}

/** A section's list scrolls past a handful of rows, so every section shows. */
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
        <div className="reveal-scrollbar max-h-36 overflow-y-auto overscroll-contain">
          <BlockStack as="ul" align="stretch">
            {children}
          </BlockStack>
        </div>
      )}
      {footer}
    </section>
  );
}

function LoadOlderRuns({
  query,
}: {
  query: ReturnType<typeof useProjectRuns>;
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
        onClick={() => void query.fetchNextPage()}
        {...tracking("projects.project_card.load_older_runs")}
      >
        {query.isFetchingNextPage ? "Loading…" : "Load older runs"}
      </Button>
    </li>
  );
}
