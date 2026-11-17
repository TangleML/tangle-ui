import { observer } from "mobx-react-lite";
import { type MouseEvent, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  ListItem,
  type ListItemAction,
  type ListItemFlair,
} from "@/components/ui/list-item";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useArchivedProjectItems } from "@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems";
import {
  type ProjectResourceItem,
  useProjectResourceItems,
} from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import {
  type ProjectFile,
  useProjectSessionFiles,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessionFiles";
import { fileIcon } from "@/routes/v2/pages/Tangent/services/projectFiles";
import {
  mergeProjectRuns,
  type RunEntry,
} from "@/routes/v2/pages/Tangent/services/projectRunEntries";
import {
  formatWorkareaTarget,
  parseIdentity,
  runTarget,
  type WorkareaTarget,
} from "@/services/projects/resourceTarget";
import {
  useProjectRuns,
  useRunExecutionStats,
} from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";
import { hasNewTabModifier } from "@/utils/dom";
import {
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
  isInProgressStatus,
} from "@/utils/executionStatus";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { AddResourceButton } from "./AddResourceButton";
import { useDismissProjectCard } from "./projectCardContext";
import { SearchField } from "./SearchField";

const FAILED_STATUSES = new Set([
  "FAILED",
  "UPSTREAM_FAILED",
  "UPSTREAM_FAILED_OR_SKIPPED",
  "SYSTEM_ERROR",
  "INVALID",
]);

type AttachedItem = ProjectResourceItem & { target: WorkareaTarget };

type CardView = "main" | "files" | "archived";

const runKey = (run: RunEntry) => formatWorkareaTarget(runTarget(run.id));
const attachedKey = (item: AttachedItem) => formatWorkareaTarget(item.target);

function runStatusFlair(
  status: string | undefined,
  label: string,
): ListItemFlair {
  if (status === "SUCCEEDED") return { kind: "dot", label, tone: "success" };
  if (status && FAILED_STATUSES.has(status)) {
    return { kind: "dot", label, tone: "critical" };
  }
  if (isInProgressStatus(status)) {
    return { kind: "dot", label, tone: "success", pulse: true };
  }
  return { kind: "dot", label };
}

function ago(date: Date | null | undefined): string | undefined {
  return date ? formatRelativeTime(date) : undefined;
}

function split<T>(items: T[], isArchived: (item: T) => boolean) {
  return {
    active: items.filter((item) => !isArchived(item)),
    archived: items.filter(isArchived),
  };
}

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
  const dismissCard = useDismissProjectCard();
  const notify = useToastNotification();
  const [query, setQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [view, setView] = useState<CardView>("main");
  const resourceItems = useProjectResourceItems(store.projectId);
  const { resources, summaries } = resourceItems;
  const projectRuns = useProjectRuns(store.projectId);
  const files = useProjectSessionFiles(store.projectId);
  const { isArchived, archive, restore } = useArchivedProjectItems(
    store.projectId,
  );

  const needle = query.trim().toLocaleLowerCase();
  const searching = needle !== "";
  const matches = (...texts: string[]) =>
    !searching ||
    texts.some((text) => text.toLocaleLowerCase().includes(needle));

  const addedAt = new Map(
    summaries.map(({ id, createdAt }) => [id, createdAt]),
  );
  const newestAdded = (a: AttachedItem, b: AttachedItem) =>
    (addedAt.get(b.id)?.getTime() ?? 0) - (addedAt.get(a.id)?.getTime() ?? 0);
  const attached: AttachedItem[] = resources.flatMap((item) =>
    item.target ? [{ ...item, target: item.target }] : [],
  );
  const pipelines = split(
    attached
      .filter(({ target }) => target.type === "pipeline")
      .sort(newestAdded),
    (item) => isArchived(attachedKey(item)),
  );
  const documents = split(
    attached
      .filter(({ target }) => target.type === "document")
      .sort(newestAdded),
    (item) => isArchived(attachedKey(item)),
  );
  const runs = split(
    mergeProjectRuns(
      projectRuns.data ?? [],
      attached
        .filter(({ target }) => target.type === "run")
        .map(({ id, name, target }) => ({
          id: parseIdentity(target.identity).value,
          pipelineName: name,
          ranAt: addedAt.get(id) ?? null,
        })),
    ),
    (run) => isArchived(runKey(run)),
  );
  const archivedCount =
    runs.archived.length +
    pipelines.archived.length +
    documents.archived.length;

  const fileMatches = ({ title, path }: ProjectFile) => matches(title, path);
  const shownReports = files.reports.filter(fileMatches);
  const shownOtherFiles = searching
    ? files.files.filter((file) => !file.pinned && fileMatches(file))
    : [];
  const shownRuns = runs.active.filter(({ pipelineName }) =>
    matches(pipelineName),
  );
  const shownPipelines = pipelines.active.filter(({ name }) => matches(name));
  const shownDocuments = documents.active.filter(({ name }) => matches(name));
  const nothingMatches =
    searching &&
    [
      shownReports,
      shownOtherFiles,
      shownRuns,
      shownPipelines,
      shownDocuments,
    ].every((list) => list.length === 0);

  async function openTarget(target: WorkareaTarget, title: string) {
    dismissCard();
    try {
      await store.openWorkareaTarget(target, title);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  function openRun(run: RunEntry, event: MouseEvent) {
    if (hasNewTabModifier(event)) {
      window.open(getDefaultRunPath(run.id), "_blank");
      return;
    }
    void openTarget(runTarget(run.id), run.pipelineName);
  }

  function openFile(file: ProjectFile) {
    dismissCard();
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
        density="compact"
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

  function renderRun(run: RunEntry) {
    return (
      <RunItem
        key={run.id}
        run={run}
        action={archiveAction(runKey(run), run.pipelineName)}
        onOpen={(event) => openRun(run, event)}
      />
    );
  }

  function renderAttached(item: AttachedItem) {
    const isPipeline = item.target.type === "pipeline";
    const added = ago(addedAt.get(item.id));
    return (
      <ListItem
        key={item.id}
        density="compact"
        icon={isPipeline ? "GitBranch" : "FileText"}
        title={item.name}
        subtitle={added && `Added ${added}`}
        onOpen={() => void openTarget(item.target, item.name)}
        tracking={tracking(
          isPipeline
            ? "projects.project_card.open_pipeline"
            : "projects.project_card.open_document",
        )}
        actions={[archiveAction(attachedKey(item), item.name)]}
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
    const fileNeedle = fileQuery.trim().toLocaleLowerCase();
    const shownFiles = files.files.filter(({ title, path }) =>
      [title, path].some((text) =>
        text.toLocaleLowerCase().includes(fileNeedle),
      ),
    );
    return (
      <SubView title="All files" count={files.files.length} onBack={back}>
        <div className="px-2">
          <SearchField
            value={fileQuery}
            onChange={setFileQuery}
            label="Search all files"
            trackingPrefix="projects.project_card.all_files"
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

  if (view === "archived") {
    const groups = [
      { title: "Runs", items: runs.archived.map(renderRun) },
      { title: "Pipelines", items: pipelines.archived.map(renderAttached) },
      { title: "Documents", items: documents.archived.map(renderAttached) },
    ].filter(({ items }) => items.length > 0);

    return (
      <SubView title="Archived" count={archivedCount} onBack={back}>
        {groups.length === 0 ? (
          <EmptyNote>Nothing is archived</EmptyNote>
        ) : (
          <div className="divide-y divide-border">
            {groups.map(({ title, items }) => (
              <CardSection key={title} title={title} count={items.length}>
                {items}
              </CardSection>
            ))}
          </div>
        )}
      </SubView>
    );
  }

  return (
    <BlockStack align="stretch">
      <div className="p-2 pb-0">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search this project"
          trackingPrefix="projects.project_card"
        />
      </div>
      {nothingMatches && <EmptyNote>Nothing in this project matches</EmptyNote>}
      <div className="divide-y divide-border">
        {files.files.length > 0 && (!searching || shownReports.length > 0) && (
          <CardSection
            title="Reports"
            count={shownReports.length}
            empty="Nothing has been pinned as a report yet"
            footer={
              searching ? undefined : (
                <FooterButton
                  icon="Files"
                  label="All files"
                  count={files.files.length}
                  onClick={() => setView("files")}
                  trackingId="projects.project_card.all_files"
                />
              )
            }
          >
            {shownReports.map((file) => renderFile(file))}
          </CardSection>
        )}
        {shownOtherFiles.length > 0 && (
          <CardSection title="Other files" count={shownOtherFiles.length}>
            {shownOtherFiles.map((file) => renderFile(file))}
          </CardSection>
        )}
        {(!searching || shownRuns.length > 0) && (
          <CardSection
            title="Runs"
            count={shownRuns.length}
            action={add("run")}
            empty={emptyNote(
              [projectRuns, resourceItems],
              "this project's runs",
              "Nothing has been run yet",
            )}
          >
            {shownRuns.map(renderRun)}
            {!searching && <LoadOlderRuns query={projectRuns} />}
          </CardSection>
        )}
        {(!searching || shownPipelines.length > 0) && (
          <CardSection
            title="Pipelines"
            count={shownPipelines.length}
            action={add("pipeline")}
            empty={emptyNote(
              [resourceItems],
              "this project's pipelines",
              "No pipelines yet",
            )}
          >
            {shownPipelines.map(renderAttached)}
          </CardSection>
        )}
        {(!searching || shownDocuments.length > 0) && (
          <CardSection
            title="Documents"
            count={shownDocuments.length}
            action={add("document")}
            empty={emptyNote(
              [resourceItems],
              "this project's documents",
              "No documents yet",
            )}
          >
            {shownDocuments.map(renderAttached)}
          </CardSection>
        )}
      </div>
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
          variant="ghost"
          size="icon"
          aria-label="Back"
          title="Back"
          onClick={onBack}
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
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
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-auto w-full justify-start gap-2 px-2 py-1.5 font-normal text-muted-foreground hover:text-foreground"
      {...tracking(trackingId)}
    >
      <Icon name={icon} size="sm" />
      {label}
      <span className="ms-auto text-xs">{count}</span>
    </Button>
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

function RunItem({
  run,
  action,
  onOpen,
}: {
  run: RunEntry;
  action: ListItemAction;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { data, isPending, error } = useRunExecutionStats(run.id);
  const status = error
    ? undefined
    : getOverallExecutionStatusFromStats(data ?? undefined);
  const label = getExecutionStatusLabel(status);

  return (
    <ListItem
      density="compact"
      icon="Play"
      title={run.pipelineName}
      subtitle={ago(run.ranAt)}
      flair={isPending ? undefined : runStatusFlair(status, label)}
      onOpen={onOpen}
      tracking={tracking("projects.project_card.open_run")}
      actions={[action]}
    />
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
        variant="ghost"
        size="sm"
        disabled={query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}
        className="h-auto w-full justify-start px-2 py-1.5 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        {...tracking("projects.project_card.load_older_runs")}
      >
        {query.isFetchingNextPage ? "Loading…" : "Load older runs"}
      </Button>
    </li>
  );
}
