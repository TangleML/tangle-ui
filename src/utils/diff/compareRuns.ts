import type { ArgumentType } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

import type {
  ChangeType,
  MetadataDiff,
  RunComparisonData,
  RunDiffResult,
  TaskDiff,
  TaskForComparison,
  ValueDiff,
} from "./types";

/**
 * Stringify an argument value for display and comparison
 */
export function stringifyArgumentValue(value: ArgumentType | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Determine the change type for a set of values across runs
 */
function getChangeType(values: (string | undefined)[]): ChangeType {
  const definedValues = values.filter((v) => v !== undefined);

  if (definedValues.length === 0) {
    return "unchanged";
  }

  if (definedValues.length < values.length) {
    // Some runs have the value, some don't
    if (definedValues.length === values.length - 1) {
      // Check if first run doesn't have it (added) or last run doesn't have it (removed)
      if (values[0] === undefined) {
        return "added";
      }
      if (values[values.length - 1] === undefined) {
        return "removed";
      }
    }
    return "modified";
  }

  // All runs have values - check if they're the same
  const firstValue = definedValues[0];
  const allSame = definedValues.every((v) => v === firstValue);

  return allSame ? "unchanged" : "modified";
}

/**
 * Create a ValueDiff from values across runs
 */
function createValueDiff(key: string, values: (string | undefined)[]): ValueDiff {
  return {
    key,
    values,
    changeType: getChangeType(values),
  };
}

/**
 * Extract tasks from a ComponentSpec for comparison
 */
function extractTasksForComparison(
  run: RunComparisonData,
): Map<string, TaskForComparison> {
  const tasks = new Map<string, TaskForComparison>();

  if (!run.componentSpec?.implementation) {
    return tasks;
  }

  if (!isGraphImplementation(run.componentSpec.implementation)) {
    return tasks;
  }

  const graphTasks = run.componentSpec.implementation.graph.tasks;

  for (const [taskId, taskSpec] of Object.entries(graphTasks)) {
    tasks.set(taskId, {
      taskId,
      componentName: taskSpec.componentRef.name,
      componentDigest: taskSpec.componentRef.digest,
      arguments: taskSpec.arguments ?? {},
    });
  }

  return tasks;
}

/**
 * Compare metadata between runs
 */
function compareMetadata(runs: RunComparisonData[]): MetadataDiff {
  return {
    createdAt: createValueDiff(
      "Created At",
      runs.map((r) => r.createdAt),
    ),
    createdBy: createValueDiff(
      "Created By",
      runs.map((r) => r.createdBy),
    ),
    status: createValueDiff(
      "Status",
      runs.map((r) => r.status),
    ),
  };
}

/**
 * Compare pipeline arguments between runs
 */
function compareArguments(runs: RunComparisonData[]): ValueDiff[] {
  // Collect all unique argument keys across all runs
  const allKeys = new Set<string>();

  for (const run of runs) {
    if (run.arguments) {
      Object.keys(run.arguments).forEach((key) => allKeys.add(key));
    }
  }

  const diffs: ValueDiff[] = [];

  for (const key of allKeys) {
    const values = runs.map((run) =>
      stringifyArgumentValue(run.arguments?.[key]),
    );

    // Only return non-empty or if at least one run has this argument
    const hasAnyValue = values.some((v) => v !== "");
    if (hasAnyValue) {
      const diff = createValueDiff(key, values.map((v) => v || undefined));
      diffs.push(diff);
    }
  }

  // Sort by key name
  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Compare tasks between runs
 */
function compareTasks(runs: RunComparisonData[]): RunDiffResult["tasks"] {
  const taskMaps = runs.map((run) => extractTasksForComparison(run));

  // Collect all unique task IDs across all runs
  const allTaskIds = new Set<string>();
  taskMaps.forEach((map) => map.forEach((_, id) => allTaskIds.add(id)));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: TaskDiff[] = [];
  const unchanged: string[] = [];

  for (const taskId of allTaskIds) {
    const tasksInRuns = taskMaps.map((map) => map.get(taskId));
    const presentCount = tasksInRuns.filter(Boolean).length;

    // Determine if task was added/removed
    if (presentCount < runs.length) {
      // Task doesn't exist in all runs
      if (tasksInRuns[0] === undefined && tasksInRuns.some(Boolean)) {
        added.push(taskId);
      } else if (tasksInRuns[0] !== undefined && tasksInRuns.some((t) => !t)) {
        removed.push(taskId);
      }
      continue;
    }

    // Task exists in all runs - compare details
    const taskDiff = compareTask(taskId, tasksInRuns as TaskForComparison[]);

    if (taskDiff.changeType === "unchanged") {
      unchanged.push(taskId);
    } else {
      modified.push(taskDiff);
    }
  }

  return { added, removed, modified, unchanged };
}

/**
 * Compare a single task across runs
 */
function compareTask(
  taskId: string,
  tasks: TaskForComparison[],
): TaskDiff {
  const digestDiff = createValueDiff(
    "Component Digest",
    tasks.map((t) => t.componentDigest),
  );

  const componentNameDiff = createValueDiff(
    "Component Name",
    tasks.map((t) => t.componentName),
  );

  // Compare arguments
  const allArgKeys = new Set<string>();
  tasks.forEach((task) =>
    Object.keys(task.arguments).forEach((key) => allArgKeys.add(key)),
  );

  const argumentsDiff: ValueDiff[] = [];

  for (const key of allArgKeys) {
    const values = tasks.map((task) =>
      stringifyArgumentValue(task.arguments[key]),
    );
    const diff = createValueDiff(key, values.map((v) => v || undefined));

    if (diff.changeType !== "unchanged") {
      argumentsDiff.push(diff);
    }
  }

  // Determine overall change type
  const hasDigestChange = digestDiff.changeType !== "unchanged";
  const hasArgumentChanges = argumentsDiff.length > 0;
  const changeType: ChangeType =
    hasDigestChange || hasArgumentChanges ? "modified" : "unchanged";

  return {
    taskId,
    changeType,
    digestDiff: hasDigestChange ? digestDiff : undefined,
    componentNameDiff:
      componentNameDiff.changeType !== "unchanged"
        ? componentNameDiff
        : undefined,
    argumentsDiff,
  };
}

/**
 * Compare multiple pipeline runs and return a structured diff
 */
export function compareRuns(runs: RunComparisonData[]): RunDiffResult {
  if (runs.length < 2) {
    throw new Error("At least 2 runs are required for comparison");
  }

  const metadata = compareMetadata(runs);
  const arguments_ = compareArguments(runs);
  const tasks = compareTasks(runs);

  const argumentChanges = arguments_.filter(
    (a) => a.changeType !== "unchanged",
  ).length;
  const taskChanges =
    tasks.added.length + tasks.removed.length + tasks.modified.length;

  return {
    runIds: runs.map((r) => r.runId),
    metadata,
    arguments: arguments_,
    tasks,
    summary: {
      totalArgumentChanges: argumentChanges,
      totalTaskChanges: taskChanges,
      hasChanges: argumentChanges > 0 || taskChanges > 0,
    },
  };
}

