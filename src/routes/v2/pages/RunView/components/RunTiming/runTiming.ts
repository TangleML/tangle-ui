import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

import type {
  RunTimingData,
  RunTimingMetrics,
  RunTimingPhase,
  RunTimingTask,
  RunTimingTaskSource,
} from "./runTiming.types";

function parseTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function makePhase(
  name: RunTimingPhase["name"],
  startAt: number | undefined,
  endAt: number | undefined,
): RunTimingPhase | undefined {
  if (startAt === undefined || endAt === undefined || endAt < startAt) {
    return undefined;
  }

  return { name, startAt, endAt, durationMs: endAt - startAt };
}

interface BaseTaskTiming {
  status?: string;
  runtimeStart?: number;
  runtimeEnd?: number;
  historicalRuntimeMs?: number;
  cacheState: RunTimingTask["cacheState"];
}

function normalizeBaseTiming(
  source: RunTimingTaskSource,
  runCreatedAt: number | undefined,
  now: number,
): BaseTaskTiming {
  if (source.isSubgraph) return { cacheState: "unknown" };

  const status = source.containerState?.status;
  const runtimeStart = parseTimestamp(source.containerState?.started_at);
  const reportedEnd = parseTimestamp(source.containerState?.ended_at);
  const runtimeEnd =
    runtimeStart !== undefined && reportedEnd === undefined ? now : reportedEnd;
  const reportedRuntimeMs =
    runtimeStart !== undefined && runtimeEnd !== undefined
      ? Math.max(0, runtimeEnd - runtimeStart)
      : undefined;
  const cacheState =
    runtimeStart === undefined
      ? "unknown"
      : reportedEnd !== undefined &&
          runCreatedAt !== undefined &&
          runtimeStart < runCreatedAt
        ? "hit"
        : "miss";

  return {
    status,
    runtimeStart,
    runtimeEnd,
    historicalRuntimeMs: cacheState === "hit" ? reportedRuntimeMs : undefined,
    cacheState,
  };
}

function descendantExecutionIds(
  executionId: string,
  childrenByParent: Map<string, RunTimingTaskSource[]>,
): string[] {
  const descendants: string[] = [];
  const queue = [...(childrenByParent.get(executionId) ?? [])];
  for (let index = 0; index < queue.length; index += 1) {
    const child = queue[index];
    descendants.push(child.executionId);
    queue.push(...(childrenByParent.get(child.executionId) ?? []));
  }
  return descendants;
}

function resolveArtifactDependencies(
  sources: RunTimingTaskSource[],
  baseTimingById: Map<string, BaseTaskTiming>,
): Map<string, string[]> {
  const sourceById = new Map(
    sources.map((source) => [source.executionId, source]),
  );
  const childrenByParent = new Map<string, RunTimingTaskSource[]>();
  const producerByArtifactId = new Map<string, string>();

  for (const source of sources) {
    const siblings = childrenByParent.get(source.parentExecutionId) ?? [];
    siblings.push(source);
    childrenByParent.set(source.parentExecutionId, siblings);
    for (const artifactId of source.outputArtifactIds) {
      if (!producerByArtifactId.has(artifactId)) {
        producerByArtifactId.set(artifactId, source.executionId);
      }
    }
  }

  const resolveProducerToLeaf = (executionId: string): string | undefined => {
    const source = sourceById.get(executionId);
    if (!source) return undefined;
    if (!source.isSubgraph) return executionId;

    return descendantExecutionIds(executionId, childrenByParent)
      .filter((descendantId) => {
        const descendant = sourceById.get(descendantId);
        return descendant && !descendant.isSubgraph;
      })
      .reduce<string | undefined>((latestId, candidateId) => {
        const candidateEnd = baseTimingById.get(candidateId)?.runtimeEnd;
        if (candidateEnd === undefined) return latestId;
        if (latestId === undefined) return candidateId;
        const latestEnd = baseTimingById.get(latestId)?.runtimeEnd;
        return latestEnd === undefined || candidateEnd > latestEnd
          ? candidateId
          : latestId;
      }, undefined);
  };

  return new Map(
    sources.map((source) => {
      const dependencies = new Set<string>();
      for (const artifactId of source.inputArtifactIds) {
        const producerId = producerByArtifactId.get(artifactId);
        if (!producerId || producerId === source.executionId) continue;
        const leafProducerId = resolveProducerToLeaf(producerId);
        if (leafProducerId && leafProducerId !== source.executionId) {
          dependencies.add(leafProducerId);
        }
      }
      return [source.executionId, [...dependencies]];
    }),
  );
}

function deriveLeafTasks(
  sources: RunTimingTaskSource[],
  baseTimingById: Map<string, BaseTaskTiming>,
  dependencies: Map<string, string[]>,
  rangeStart: number,
): RunTimingTask[] {
  const sourceById = new Map(
    sources.map((source) => [source.executionId, source]),
  );
  const completionById = new Map<string, number>();
  const visiting = new Set<string>();

  const effectiveCompletion = (executionId: string): number => {
    const knownCompletion = completionById.get(executionId);
    if (knownCompletion !== undefined) return knownCompletion;
    if (visiting.has(executionId)) return rangeStart;

    visiting.add(executionId);
    const timing = baseTimingById.get(executionId);
    let completion = rangeStart;
    if (timing?.cacheState !== "hit" && timing?.runtimeEnd !== undefined) {
      completion = timing.runtimeEnd;
    } else {
      for (const dependencyId of dependencies.get(executionId) ?? []) {
        completion = Math.max(completion, effectiveCompletion(dependencyId));
      }
    }
    visiting.delete(executionId);
    completionById.set(executionId, completion);
    return completion;
  };

  return sources
    .filter((source) => !source.isSubgraph)
    .map((source): RunTimingTask => {
      const timing = baseTimingById.get(source.executionId) ?? {
        cacheState: "unknown",
      };
      const dependencyExecutionIds = (
        dependencies.get(source.executionId) ?? []
      ).filter((executionId) => sourceById.has(executionId));
      const readyAt = dependencyExecutionIds.reduce(
        (latest, executionId) =>
          Math.max(latest, effectiveCompletion(executionId)),
        rangeStart,
      );
      const isFresh = timing.cacheState !== "hit";
      const startupPhase = isFresh
        ? makePhase("startup", readyAt, timing.runtimeStart)
        : undefined;
      const runtimePhase = isFresh
        ? makePhase("runtime", timing.runtimeStart, timing.runtimeEnd)
        : undefined;
      const phases = [startupPhase, runtimePhase].filter(
        (phase): phase is RunTimingPhase => phase !== undefined,
      );
      const startAt = timing.cacheState === "hit" ? rangeStart : readyAt;
      const endAt =
        timing.cacheState === "hit" ? rangeStart : timing.runtimeEnd;
      const durationMs =
        startAt !== undefined && endAt !== undefined
          ? Math.max(0, endAt - startAt)
          : undefined;
      const componentRef = source.details?.task_spec.componentRef;

      return {
        executionId: source.executionId,
        parentExecutionId: source.parentExecutionId,
        taskId: source.taskId,
        taskName: source.taskId,
        navigationPath: source.navigationPath,
        depth: source.depth,
        dependencyExecutionIds,
        componentName:
          componentRef?.spec?.name ?? componentRef?.name ?? undefined,
        componentDigest: componentRef?.digest ?? undefined,
        isSubgraph: false,
        status: timing.status,
        phases,
        readyAt,
        startAt,
        endAt,
        durationMs,
        historicalRuntimeMs: timing.historicalRuntimeMs,
        cacheState: timing.cacheState,
        timingQuality:
          timing.runtimeStart === undefined
            ? "unavailable"
            : timing.status === "RUNNING"
              ? "partial"
              : "complete",
      };
    });
}

function deriveSubgraphTasks(
  sources: RunTimingTaskSource[],
  leafTasks: RunTimingTask[],
  dependencies: Map<string, string[]>,
): RunTimingTask[] {
  const tasksByParent = new Map<string, RunTimingTask[]>();
  for (const task of leafTasks) {
    const siblings = tasksByParent.get(task.parentExecutionId) ?? [];
    siblings.push(task);
    tasksByParent.set(task.parentExecutionId, siblings);
  }

  const subgraphSources = sources
    .filter((source) => source.isSubgraph)
    .sort((left, right) => right.depth - left.depth);
  const subgraphTasks: RunTimingTask[] = [];

  for (const source of subgraphSources) {
    const children = tasksByParent.get(source.executionId) ?? [];
    const freshDescendants = children.filter(
      (task) => task.cacheState !== "hit" && task.endAt !== undefined,
    );
    const starts = freshDescendants.flatMap((task) =>
      task.readyAt === undefined ? [] : [task.readyAt],
    );
    const ends = freshDescendants.flatMap((task) =>
      task.endAt === undefined ? [] : [task.endAt],
    );
    const statusCounts = children.reduce<Record<string, number>>(
      (counts, task) => {
        if (task.status) counts[task.status] = (counts[task.status] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const startAt = starts.length > 0 ? Math.min(...starts) : undefined;
    const endAt = ends.length > 0 ? Math.max(...ends) : undefined;
    const componentRef = source.details?.task_spec.componentRef;
    const task: RunTimingTask = {
      executionId: source.executionId,
      parentExecutionId: source.parentExecutionId,
      taskId: source.taskId,
      taskName: source.taskId,
      navigationPath: source.navigationPath,
      depth: source.depth,
      dependencyExecutionIds: dependencies.get(source.executionId) ?? [],
      componentName:
        componentRef?.spec?.name ?? componentRef?.name ?? undefined,
      componentDigest: componentRef?.digest ?? undefined,
      isSubgraph: true,
      status: getOverallExecutionStatusFromStats(statusCounts),
      phases: [],
      readyAt: startAt,
      startAt,
      endAt,
      durationMs:
        startAt !== undefined && endAt !== undefined
          ? endAt - startAt
          : undefined,
      cacheState: "unknown",
      timingQuality:
        freshDescendants.length === 0
          ? "unavailable"
          : freshDescendants.every(
                (descendant) => descendant.timingQuality === "complete",
              )
            ? "complete"
            : "partial",
    };
    subgraphTasks.push(task);

    const siblings = tasksByParent.get(source.parentExecutionId) ?? [];
    siblings.push(task);
    tasksByParent.set(source.parentExecutionId, siblings);
  }

  return subgraphTasks;
}

interface CriticalPathResult {
  executionIds: string[];
  durationMs?: number;
}

export function calculateCriticalPath(
  tasks: RunTimingTask[],
  rangeStart?: number,
): CriticalPathResult {
  const leafById = new Map(
    tasks
      .filter((task) => !task.isSubgraph)
      .map((task) => [task.executionId, task]),
  );
  const freshLeaves = [...leafById.values()].filter(
    (task) => task.cacheState !== "hit" && task.endAt !== undefined,
  );
  if (freshLeaves.length === 0) return { executionIds: [] };

  const effectiveCompletionById = new Map<string, number>();
  const visiting = new Set<string>();
  const effectiveCompletion = (executionId: string): number => {
    const known = effectiveCompletionById.get(executionId);
    if (known !== undefined) return known;
    if (visiting.has(executionId)) return rangeStart ?? 0;

    visiting.add(executionId);
    const task = leafById.get(executionId);
    let completion = rangeStart ?? 0;
    if (task?.cacheState !== "hit" && task?.endAt !== undefined) {
      completion = task.endAt;
    } else {
      for (const dependencyId of task?.dependencyExecutionIds ?? []) {
        completion = Math.max(completion, effectiveCompletion(dependencyId));
      }
    }
    visiting.delete(executionId);
    effectiveCompletionById.set(executionId, completion);
    return completion;
  };

  const executionIds: string[] = [];
  const seen = new Set<string>();
  let current = freshLeaves.reduce((latest, task) =>
    (task.endAt ?? 0) > (latest.endAt ?? 0) ? task : latest,
  );

  while (!seen.has(current.executionId)) {
    seen.add(current.executionId);
    executionIds.push(current.executionId);
    const dependencies = current.dependencyExecutionIds
      .map((executionId) => leafById.get(executionId))
      .filter((task): task is RunTimingTask => task !== undefined);
    if (dependencies.length === 0) break;
    current = dependencies.reduce((latest, task) =>
      effectiveCompletion(task.executionId) >
      effectiveCompletion(latest.executionId)
        ? task
        : latest,
    );
  }

  executionIds.reverse();
  const durationMs = executionIds.reduce((total, executionId) => {
    const task = leafById.get(executionId);
    if (!task || task.cacheState === "hit") return total;
    return (
      total + task.phases.reduce((sum, phase) => sum + phase.durationMs, 0)
    );
  }, 0);

  return { executionIds, durationMs };
}

function intervalUnionDuration(
  intervals: Array<{ startAt: number; endAt: number }>,
): number {
  const sorted = [...intervals].sort(
    (left, right) => left.startAt - right.startAt,
  );
  if (sorted.length === 0) return 0;

  let total = 0;
  let currentStart = sorted[0].startAt;
  let currentEnd = sorted[0].endAt;
  for (const interval of sorted.slice(1)) {
    if (interval.startAt <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.endAt);
    } else {
      total += currentEnd - currentStart;
      currentStart = interval.startAt;
      currentEnd = interval.endAt;
    }
  }
  return total + currentEnd - currentStart;
}

function calculateMetrics(
  tasks: RunTimingTask[],
  rangeStart: number,
  rangeEnd: number,
  criticalPathDurationMs: number | undefined,
): RunTimingMetrics {
  const leafTasks = tasks.filter((task) => !task.isSubgraph);
  const freshLeafTasks = leafTasks.filter((task) => task.cacheState !== "hit");
  const startupPhases = freshLeafTasks.flatMap((task) =>
    task.phases.filter((phase) => phase.name === "startup"),
  );
  const runtimePhases = freshLeafTasks.flatMap((task) =>
    task.phases.filter((phase) => phase.name === "runtime"),
  );
  const busyRuntimeMs = intervalUnionDuration(runtimePhases);

  return {
    wallClockDurationMs: rangeEnd - rangeStart,
    totalTaskCount: leafTasks.length,
    cachedTaskCount: leafTasks.filter((task) => task.cacheState === "hit")
      .length,
    averageStartupMs:
      startupPhases.length > 0
        ? startupPhases.reduce((sum, phase) => sum + phase.durationMs, 0) /
          startupPhases.length
        : undefined,
    startupCoverage: startupPhases.length,
    busyRuntimeMs,
    busyPercent:
      rangeEnd > rangeStart
        ? Math.round((busyRuntimeMs / (rangeEnd - rangeStart)) * 100)
        : 0,
    criticalPathDurationMs,
  };
}

export function normalizeRunTimingData(
  sources: RunTimingTaskSource[],
  runCreatedAt: string | null | undefined,
  now: number,
  truncated = false,
): RunTimingData {
  const createdAt = parseTimestamp(runCreatedAt);
  const baseTimingById = new Map(
    sources.map((source) => [
      source.executionId,
      normalizeBaseTiming(source, createdAt, now),
    ]),
  );
  const freshStarts = [...baseTimingById.values()].flatMap((timing) =>
    timing.cacheState !== "hit" && timing.runtimeStart !== undefined
      ? [timing.runtimeStart]
      : [],
  );
  const rangeStart = createdAt ?? Math.min(...freshStarts, now);
  const dependencies = resolveArtifactDependencies(sources, baseTimingById);
  const leafTasks = deriveLeafTasks(
    sources,
    baseTimingById,
    dependencies,
    rangeStart,
  );
  const subgraphTasks = deriveSubgraphTasks(sources, leafTasks, dependencies);
  const tasks = sources.flatMap((source) => {
    const candidates = source.isSubgraph ? subgraphTasks : leafTasks;
    const task = candidates.find(
      (candidate) => candidate.executionId === source.executionId,
    );
    return task ? [task] : [];
  });
  const freshEnds = leafTasks.flatMap((task) =>
    task.cacheState !== "hit" && task.endAt !== undefined ? [task.endAt] : [],
  );
  const rangeEnd =
    freshEnds.length > 0
      ? Math.max(...freshEnds)
      : now > rangeStart
        ? now
        : rangeStart + 1_000;
  const criticalPath = calculateCriticalPath(tasks, rangeStart);

  return {
    tasks,
    truncated,
    rangeStart,
    rangeEnd,
    criticalPathExecutionIds: new Set(criticalPath.executionIds),
    metrics: calculateMetrics(
      tasks,
      rangeStart,
      rangeEnd,
      criticalPath.durationMs,
    ),
  };
}

export function formatTimingDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs)) return "—";

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
