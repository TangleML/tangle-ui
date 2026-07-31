import type { IoDiff, TaskDiff } from "./comparePipelines";

function countChanged<T extends { status: string }>(entries: T[]): number {
  return entries.filter((entry) => entry.status !== "unchanged").length;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function componentChanged(diff: TaskDiff): boolean {
  if (!diff.a || !diff.b) return false;
  if (diff.digestA && diff.digestB) return diff.digestA !== diff.digestB;
  return !diff.sameComponentVersion;
}

/**
 * Short human summary of how a changed task differs between the two runs, used
 * as a subdued caption on graph nodes. Returns an empty string when there is
 * nothing structural to report (e.g. an outcome-only difference), letting the
 * caller decide whether to render anything.
 */
export function summarizeTaskChange(diff: TaskDiff): string {
  const parts: string[] = [];

  if (componentChanged(diff)) parts.push("component");

  const changedArguments = countChanged(diff.argumentDiffs);
  if (changedArguments > 0) parts.push(pluralize(changedArguments, "argument"));

  const changedAnnotations = countChanged(diff.annotationDiffs);
  if (changedAnnotations > 0) {
    parts.push(pluralize(changedAnnotations, "annotation"));
  }

  if (diff.cacheChanged) {
    parts.push(diff.cacheDisabledB ? "cache disabled" : "cache enabled");
  }

  return parts.join(" · ");
}

/**
 * Short human summary of how a changed pipeline input/output differs. A rewired
 * producing task is called out explicitly; otherwise the count of changed
 * fields is reported.
 */
export function summarizeIoChange(diff: IoDiff): string {
  const changedFields = diff.fieldDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );
  if (changedFields.some((entry) => entry.key === "source")) {
    return "source rewired";
  }
  if (changedFields.length === 0) return "";
  return `${pluralize(changedFields.length, "field")} changed`;
}
