import equal from "fast-deep-equal";

import type { DiffStatus } from "@/routes/v2/pages/Editor/store/actions/task.utils";
import type {
  ArgumentType,
  ComponentSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

export type { DiffStatus };

export interface KeyedDiffEntry<T> {
  key: string;
  a?: T;
  b?: T;
  status: DiffStatus;
}

export interface TaskDiff {
  taskId: string;
  status: DiffStatus;
  a?: TaskSpec;
  b?: TaskSpec;
  digestA?: string;
  digestB?: string;
  sameComponentVersion: boolean;
  statusA?: string;
  statusB?: string;
  outcomeChanged: boolean;
  argumentDiffs: KeyedDiffEntry<ArgumentType>[];
  annotationDiffs: KeyedDiffEntry<unknown>[];
}

interface ComparisonCounts {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  outcomeChanged: number;
}

export interface PipelineComparison {
  taskDiffs: TaskDiff[];
  counts: ComparisonCounts;
  hasComparableTasks: boolean;
}

/**
 * Union of keys preserving `a`'s order first, then appending keys present only
 * in `b` in `b`'s order. Mirrors the ordering of the editor's diff lists so the
 * two features read consistently.
 */
function unionKeysAFirst(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of Object.keys(a)) {
    seen.add(key);
    keys.push(key);
  }
  for (const key of Object.keys(b)) {
    if (!seen.has(key)) keys.push(key);
  }
  return keys;
}

function diffKeyedRecords<T>(
  a: Record<string, T> | undefined,
  b: Record<string, T> | undefined,
): KeyedDiffEntry<T>[] {
  const aRecord = a ?? {};
  const bRecord = b ?? {};

  return unionKeysAFirst(aRecord, bRecord).map((key) => {
    const inA = key in aRecord;
    const inB = key in bRecord;
    const aValue = inA ? aRecord[key] : undefined;
    const bValue = inB ? bRecord[key] : undefined;

    let status: DiffStatus;
    if (inA && !inB) status = "lost";
    else if (!inA && inB) status = "new";
    else status = equal(aValue, bValue) ? "unchanged" : "changed";

    return { key, a: aValue, b: bValue, status };
  });
}

function isComponentChanged(a: TaskSpec, b: TaskSpec): boolean {
  const digestA = a.componentRef.digest;
  const digestB = b.componentRef.digest;
  if (digestA && digestB) return digestA !== digestB;
  return !equal(a.componentRef, b.componentRef);
}

function buildTaskDiff(
  taskId: string,
  a: TaskSpec | undefined,
  b: TaskSpec | undefined,
  statusA: string | undefined,
  statusB: string | undefined,
): TaskDiff {
  const argumentDiffs = diffKeyedRecords(a?.arguments, b?.arguments);
  const annotationDiffs = diffKeyedRecords(a?.annotations, b?.annotations);
  const digestA = a?.componentRef.digest;
  const digestB = b?.componentRef.digest;

  let status: DiffStatus;
  if (a && !b) status = "lost";
  else if (!a && b) status = "new";
  else if (a && b) {
    const hasFieldChanges = [...argumentDiffs, ...annotationDiffs].some(
      (entry) => entry.status !== "unchanged",
    );
    status =
      isComponentChanged(a, b) || hasFieldChanges ? "changed" : "unchanged";
  } else {
    status = "unchanged";
  }

  return {
    taskId,
    status,
    a,
    b,
    digestA,
    digestB,
    sameComponentVersion: Boolean(digestA && digestB && digestA === digestB),
    statusA,
    statusB,
    outcomeChanged: (statusA ?? "") !== (statusB ?? ""),
    argumentDiffs,
    annotationDiffs,
  };
}

function getGraphTasks(
  spec: ComponentSpec | undefined,
): Record<string, TaskSpec> {
  if (!spec || !isGraphImplementation(spec.implementation)) return {};
  return spec.implementation.graph.tasks;
}

/**
 * Aligns two runs' pipeline specs by task id and produces a per-task diff of
 * component version, arguments, annotations, and execution status. Task
 * ordering follows run A first, with tasks only present in run B appended.
 */
export function buildPipelineComparison(
  specA: ComponentSpec | undefined,
  specB: ComponentSpec | undefined,
  statusMapA: Map<string, string>,
  statusMapB: Map<string, string>,
): PipelineComparison {
  const tasksA = getGraphTasks(specA);
  const tasksB = getGraphTasks(specB);

  const taskDiffs = unionKeysAFirst(tasksA, tasksB).map((taskId) =>
    buildTaskDiff(
      taskId,
      tasksA[taskId],
      tasksB[taskId],
      statusMapA.get(taskId),
      statusMapB.get(taskId),
    ),
  );

  const counts: ComparisonCounts = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    outcomeChanged: 0,
  };
  for (const diff of taskDiffs) {
    if (diff.status === "new") counts.added += 1;
    else if (diff.status === "lost") counts.removed += 1;
    else if (diff.status === "changed") counts.changed += 1;
    else counts.unchanged += 1;

    if (diff.outcomeChanged) counts.outcomeChanged += 1;
  }

  return {
    taskDiffs,
    counts,
    hasComparableTasks: taskDiffs.length > 0,
  };
}
