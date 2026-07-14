import {
  diffKeyedRecords,
  type KeyedDiffEntry,
  stripFrontendAnnotations,
} from "./comparePipelines";

const SUPERFICIAL_ANNOTATION_KEYS = new Set<string>(["notes", "tags"]);

export interface RunMetadataInput {
  createdBy?: string;
  createdAt?: string;
  annotations?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
}

interface ScalarDiff {
  a?: string;
  b?: string;
  changed: boolean;
}

export interface RunMetadataComparison {
  author: ScalarDiff;
  createdAt: ScalarDiff;
  annotationDiffs: KeyedDiffEntry<unknown>[];
  argumentDiffs: KeyedDiffEntry<unknown>[];
  changeCount: number;
  hasChanges: boolean;
}

function stripComparableAnnotations(
  annotations: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    stripFrontendAnnotations(annotations),
  )) {
    if (!SUPERFICIAL_ANNOTATION_KEYS.has(key)) result[key] = value;
  }
  return result;
}

function scalarDiff(a: string | undefined, b: string | undefined): ScalarDiff {
  return { a, b, changed: (a ?? "") !== (b ?? "") };
}

function countChanged(entries: KeyedDiffEntry<unknown>[]): number {
  return entries.filter((entry) => entry.status !== "unchanged").length;
}

/**
 * Compares run-level context between two runs. Annotation and argument keys are
 * treated generically — the platform is agnostic about which keys exist, so
 * whatever a deployment stores surfaces here. Superficial keys (notes, tags)
 * and frontend-only annotations are excluded. `createdAt` is surfaced for
 * context but does not count toward `hasChanges`, since two distinct runs
 * always have different timestamps.
 */
export function buildRunMetadataComparison(
  a: RunMetadataInput,
  b: RunMetadataInput,
): RunMetadataComparison {
  const author = scalarDiff(a.createdBy, b.createdBy);
  const createdAt = scalarDiff(a.createdAt, b.createdAt);
  const annotationDiffs = diffKeyedRecords(
    stripComparableAnnotations(a.annotations),
    stripComparableAnnotations(b.annotations),
  );
  const argumentDiffs = diffKeyedRecords(a.arguments, b.arguments);

  const changeCount =
    (author.changed ? 1 : 0) +
    countChanged(annotationDiffs) +
    countChanged(argumentDiffs);

  return {
    author,
    createdAt,
    annotationDiffs,
    argumentDiffs,
    changeCount,
    hasChanges: changeCount > 0,
  };
}
