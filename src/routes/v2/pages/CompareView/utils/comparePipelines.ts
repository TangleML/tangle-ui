import equal from "fast-deep-equal";

import type { DiffStatus } from "@/routes/v2/pages/Editor/store/actions/task.utils";
import { isCacheDisabled } from "@/utils/cache";
import type {
  ArgumentType,
  ComponentSpec,
  InputSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

export type { DiffStatus };

/**
 * Annotation keys the editor writes for layout/presentation only. They carry no
 * technical meaning for a run comparison and would otherwise surface as noise,
 * so they are stripped before diffing. Duplicated as literals rather than
 * imported from `@/utils/annotations` because that module transitively pulls in
 * the components tree, which breaks vitest mock hoisting for this leaf util.
 */
const FRONTEND_ONLY_ANNOTATION_KEYS = new Set<string>([
  "editor.position",
  "editor.collapsed",
  "editor.flow-direction",
  "zIndex",
  "flex-nodes",
  "sdk",
  "tangleml.com/editor/task-color",
  "tangleml.com/editor/edge-conduits",
]);

export function stripFrontendAnnotations<T>(
  annotations: Record<string, T> | undefined,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(annotations ?? {})) {
    if (!FRONTEND_ONLY_ANNOTATION_KEYS.has(key)) result[key] = value;
  }
  return result;
}

export interface KeyedDiffEntry<T> {
  key: string;
  a?: T;
  b?: T;
  status: DiffStatus;
}

type IoKind = "input" | "output";

export interface IoDiff {
  name: string;
  kind: IoKind;
  status: DiffStatus;
  fieldDiffs: KeyedDiffEntry<unknown>[];
  sourceTaskIdA?: string;
  sourceTaskIdB?: string;
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
  executionIdA?: string;
  executionIdB?: string;
  cacheDisabledA: boolean;
  cacheDisabledB: boolean;
  cacheChanged: boolean;
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
  inputDiffs: IoDiff[];
  outputDiffs: IoDiff[];
  counts: ComparisonCounts;
  hasComparableTasks: boolean;
  hasComparableGraph: boolean;
}

/**
 * Union of keys preserving `a`'s order first, then appending keys present only
 * in `b` in `b`'s order. Mirrors the ordering of the editor's diff lists so the
 * two features read consistently.
 */
export function unionKeysAFirst(
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

export function diffKeyedRecords<T>(
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
  executionIdA: string | undefined,
  executionIdB: string | undefined,
): TaskDiff {
  const argumentDiffs = diffKeyedRecords(a?.arguments, b?.arguments);
  const annotationDiffs = diffKeyedRecords(
    stripFrontendAnnotations(a?.annotations),
    stripFrontendAnnotations(b?.annotations),
  );
  const digestA = a?.componentRef.digest;
  const digestB = b?.componentRef.digest;

  const cacheDisabledA = isCacheDisabled(a);
  const cacheDisabledB = isCacheDisabled(b);
  const cacheChanged = Boolean(a && b && cacheDisabledA !== cacheDisabledB);

  let status: DiffStatus;
  if (a && !b) status = "lost";
  else if (!a && b) status = "new";
  else if (a && b) {
    const hasFieldChanges = [...argumentDiffs, ...annotationDiffs].some(
      (entry) => entry.status !== "unchanged",
    );
    status =
      isComponentChanged(a, b) || hasFieldChanges || cacheChanged
        ? "changed"
        : "unchanged";
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
    executionIdA,
    executionIdB,
    cacheDisabledA,
    cacheDisabledB,
    cacheChanged,
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

function getOutputValues(
  spec: ComponentSpec | undefined,
): Record<string, TaskOutputArgument> {
  if (!spec || !isGraphImplementation(spec.implementation)) return {};
  return spec.implementation.graph.outputValues ?? {};
}

function byName<T extends { name: string }>(
  specs: T[] | undefined,
): Record<string, T> {
  const record: Record<string, T> = {};
  for (const spec of specs ?? []) record[spec.name] = spec;
  return record;
}

function inputFields(spec: InputSpec | undefined): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (!spec) return fields;
  if (spec.type !== undefined) fields.type = spec.type;
  if (spec.default !== undefined) fields.default = spec.default;
  if (spec.value !== undefined) fields.value = spec.value;
  if (spec.optional !== undefined) fields.optional = spec.optional;
  if (spec.description !== undefined) fields.description = spec.description;
  return fields;
}

function outputFields(
  spec: OutputSpec | undefined,
  source: TaskOutputArgument | undefined,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (spec?.type !== undefined) fields.type = spec.type;
  if (spec?.description !== undefined) fields.description = spec.description;
  if (source) {
    fields.source = `${source.taskOutput.taskId}.${source.taskOutput.outputName}`;
  }
  return fields;
}

function ioStatus(
  inA: boolean,
  inB: boolean,
  fieldDiffs: KeyedDiffEntry<unknown>[],
): DiffStatus {
  if (inA && !inB) return "lost";
  if (!inA && inB) return "new";
  return fieldDiffs.some((entry) => entry.status !== "unchanged")
    ? "changed"
    : "unchanged";
}

function diffInputs(
  specA: ComponentSpec | undefined,
  specB: ComponentSpec | undefined,
): IoDiff[] {
  const aMap = byName(specA?.inputs);
  const bMap = byName(specB?.inputs);

  return unionKeysAFirst(aMap, bMap).map((name) => {
    const inA = name in aMap;
    const inB = name in bMap;
    const fieldDiffs = diffKeyedRecords(
      inputFields(aMap[name]),
      inputFields(bMap[name]),
    );
    return {
      name,
      kind: "input" as const,
      status: ioStatus(inA, inB, fieldDiffs),
      fieldDiffs,
    };
  });
}

function diffOutputs(
  specA: ComponentSpec | undefined,
  specB: ComponentSpec | undefined,
): IoDiff[] {
  const aMap = byName(specA?.outputs);
  const bMap = byName(specB?.outputs);
  const aOut = getOutputValues(specA);
  const bOut = getOutputValues(specB);

  return unionKeysAFirst({ ...aMap, ...aOut }, { ...bMap, ...bOut }).map(
    (name) => {
      const inA = name in aMap || name in aOut;
      const inB = name in bMap || name in bOut;
      const fieldDiffs = diffKeyedRecords(
        outputFields(aMap[name], aOut[name]),
        outputFields(bMap[name], bOut[name]),
      );
      return {
        name,
        kind: "output" as const,
        status: ioStatus(inA, inB, fieldDiffs),
        fieldDiffs,
        sourceTaskIdA: aOut[name]?.taskOutput.taskId,
        sourceTaskIdB: bOut[name]?.taskOutput.taskId,
      };
    },
  );
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
  executionIdMapA: Map<string, string> = new Map(),
  executionIdMapB: Map<string, string> = new Map(),
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
      executionIdMapA.get(taskId),
      executionIdMapB.get(taskId),
    ),
  );

  const inputDiffs = diffInputs(specA, specB);
  const outputDiffs = diffOutputs(specA, specB);

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
    inputDiffs,
    outputDiffs,
    counts,
    hasComparableTasks: taskDiffs.length > 0,
    hasComparableGraph:
      taskDiffs.length > 0 || inputDiffs.length > 0 || outputDiffs.length > 0,
  };
}
