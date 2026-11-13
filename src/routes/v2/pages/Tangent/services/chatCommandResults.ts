import type { ProjectCardEntry } from "@/routes/v2/pages/Tangent/services/createProjectCardHandlers";
import type { SessionFileRecord } from "@/routes/v2/pages/Tangent/services/sessionFiles";
import {
  parseIdentity,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";
import { formatDate } from "@/utils/date";
import { pluralize } from "@/utils/string";

const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

export const RUN_LIMIT = 10;
export const ASSET_LIMIT = 5;

/** What the card lists, for the chat's slash commands to show. */
export interface ProjectListing {
  runs: ProjectCardEntry[];
  pipelines: ProjectCardEntry[];
  documents: ProjectCardEntry[];
  reports: SessionFileRecord[];
  runStatuses: ReadonlyMap<string, string>;
}

/** A pipeline `/run` was asked to start, and how that went. */
export interface RunStart {
  id: string;
  name?: string;
  runTarget?: string;
  error?: string;
}

interface FileLinks {
  thisChat?: string;
  fileUrl: (file: SessionFileRecord) => string;
}

function link(name: string, href: string): string {
  return `[${name.replace(/[[\]\\]/g, "\\$&")}](${href})`;
}

function plural(count: number, noun: string): string {
  return `${count} ${pluralize(count, noun)}`;
}

/** The id a target names: a pipeline's, which `/run` takes, or a run's. */
export function targetId(target: string): string {
  return parseIdentity(parseWorkareaTarget(target).identity).value;
}

/**
 * Ids separated by commas or spaces, optionally in brackets, each once. A
 * pipeline kept in this browser is known by its name, which may hold spaces,
 * so the whole of what was typed is tried as one of `knownIds` first.
 */
export function parsePipelineIds(
  args: string,
  knownIds: string[] = [],
): string[] {
  const whole = args.replace(/^\s*\[|\]\s*$/g, "").trim();
  if (knownIds.includes(whole)) return [whole];
  return [
    ...new Set(
      args
        .replace(/[[\]]/g, " ")
        .split(/[\s,]+/)
        .filter(Boolean),
    ),
  ];
}

function added(at: Date | null): string {
  return at ? ` · added ${formatDate(at, DAY)}` : "";
}

function pipelineRow({ target, name, at }: ProjectCardEntry): string {
  return `${link(name, target)} · id \`${targetId(target)}\`${added(at)}`;
}

function documentRow({ target, name, at }: ProjectCardEntry): string {
  return `${link(name, target)}${added(at)}`;
}

function runRow(runStatuses: ReadonlyMap<string, string>) {
  return ({ target, name, at }: ProjectCardEntry) =>
    [link(name, target), runStatuses.get(target), at && formatDate(at)]
      .filter(Boolean)
      .join(" · ");
}

// A link's address ends at its first space unless it's in angle brackets, and
// a file's path can hold one. Bracketed, it's read whole and the agent still
// sees the real path.
function fileAddress(address: string): string {
  return /[\s()<>]/.test(address) ? `<${address}>` : address;
}

function fileRow({ thisChat, fileUrl }: FileLinks) {
  return (file: SessionFileRecord) =>
    file.sessionId === thisChat
      ? link(file.title, fileAddress(file.path))
      : `${link(file.title, fileAddress(fileUrl(file)))} · another chat`;
}

/**
 * A titled list, cut off at `limit` with a count of the rest. Blank lines keep
 * each note out of the list above it.
 */
function section<T>(
  title: string,
  items: T[],
  row: (item: T) => string,
  { limit = items.length, more }: { limit?: number; more?: string } = {},
): string {
  const shown = items.slice(0, limit);
  const lines = [`**${title}** · ${items.length}`, ""];
  lines.push(...shown.map((item) => `- ${row(item)}`));
  const hidden = items.length - shown.length;
  if (hidden > 0)
    lines.push("", `…and ${hidden} more.${more ? ` ${more}` : ""}`);
  return lines.join("\n");
}

function withArchivedNote(text: string, count: number, noun: string): string {
  return count > 0
    ? `${text}\n\n${plural(count, `archived ${noun}`)} not listed.`
    : text;
}

function active(entries: ProjectCardEntry[]) {
  return entries.filter(({ archived }) => !archived);
}

export function pipelinesResult({ pipelines }: ProjectListing) {
  if (pipelines.length === 0) return "This project has no pipelines yet.";
  const shown = active(pipelines);
  return withArchivedNote(
    section("Pipelines", shown, pipelineRow),
    pipelines.length - shown.length,
    "pipeline",
  );
}

export function documentsResult({ documents }: ProjectListing) {
  if (documents.length === 0) return "This project has no documents yet.";
  const shown = active(documents);
  return withArchivedNote(
    section("Documents", shown, documentRow),
    documents.length - shown.length,
    "document",
  );
}

export function runsResult({ runs, runStatuses }: ProjectListing) {
  if (runs.length === 0) return "Nothing has been run in this project yet.";
  const shown = active(runs);
  return withArchivedNote(
    section("Runs", shown, runRow(runStatuses), { limit: RUN_LIMIT }),
    runs.length - shown.length,
    "run",
  );
}

export function filesResult(files: SessionFileRecord[], links: FileLinks) {
  if (files.length === 0) {
    return "The chats in this project haven't made any files yet.";
  }
  const reports = files.filter(({ pinned }) => pinned);
  const others = files.filter(({ pinned }) => !pinned);
  return [
    reports.length > 0 && section("Reports", reports, fileRow(links)),
    others.length > 0 && section("Other files", others, fileRow(links)),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A few of each, newest first, pointing at the command that lists the rest. */
export function assetsResult(listing: ProjectListing, links: FileLinks) {
  const runs = active(listing.runs);
  const pipelines = active(listing.pipelines);
  const documents = active(listing.documents);
  const limit = ASSET_LIMIT;
  const sections = [
    listing.reports.length > 0 &&
      section("Reports", listing.reports, fileRow(links), {
        limit,
        more: "`/files` lists them all.",
      }),
    runs.length > 0 &&
      section("Runs", runs, runRow(listing.runStatuses), {
        limit,
        more: "`/runs` lists the latest.",
      }),
    pipelines.length > 0 &&
      section("Pipelines", pipelines, pipelineRow, {
        limit,
        more: "`/pipelines` lists them all.",
      }),
    documents.length > 0 &&
      section("Documents", documents, documentRow, {
        limit,
        more: "`/documents` lists them all.",
      }),
  ].filter(Boolean);
  return sections.length > 0
    ? sections.join("\n\n")
    : "This project doesn't have anything in it yet.";
}

function bullets(intro: string, items: string[]): string {
  return [intro, "", ...items.map((item) => `- ${item}`)].join("\n");
}

export function runStartsResult(starts: RunStart[]): string {
  const started = starts.flatMap(({ name, id, runTarget }) =>
    runTarget ? [link(name ?? id, runTarget)] : [],
  );
  const failed = starts.flatMap(({ id, name, runTarget, error }) =>
    runTarget
      ? []
      : [`\`${id}\`${name ? ` (${name})` : ""}: ${error ?? "didn't start"}`],
  );
  return [
    started.length > 0 &&
      bullets(`Started ${plural(started.length, "run")}:`, started),
    failed.length > 0 &&
      bullets(`Couldn't start ${plural(failed.length, "pipeline")}:`, failed),
  ]
    .filter(Boolean)
    .join("\n\n");
}
