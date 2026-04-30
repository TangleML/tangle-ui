import { useEffect } from "react";

import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import { getAllComponentFilesFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { getStorage } from "@/utils/typedStorage";

// ─── Node counting ────────────────────────────────────────────────────────────

/**
 * Counts nodes in a pipeline spec, flattening any inline subgraphs recursively.
 * Each subgraph's components (including its own IO nodes) replace the subgraph
 * task itself in the count.
 */
function countPipelineNodes(spec: ComponentSpec): number {
  if (!isGraphImplementation(spec.implementation)) return 0;

  const graph = spec.implementation.graph;
  const inputCount = spec.inputs?.length ?? 0;
  const outputCount = spec.outputs?.length ?? 0;
  const taskCount = Object.values(graph.tasks).reduce(
    (sum, task) => sum + countTaskNodes(task),
    0,
  );

  return inputCount + outputCount + taskCount;
}

function countTaskNodes(task: TaskSpec): number {
  const inlineSpec = task.componentRef.spec;
  if (inlineSpec && isGraphImplementation(inlineSpec.implementation)) {
    // Decompose the inline subgraph: replace it with its own nodes recursively.
    return countPipelineNodes(inlineSpec);
  }
  return 1;
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

// Bucket boundaries follow Fibonacci numbers (5, 13, 34, 89, 233) to give
// fine-grained visibility at low node counts and coverage into 200+ node graphs.
type PipelineNodeBucket =
  | "0"
  | "1_to_5"
  | "6_to_13"
  | "14_to_34"
  | "35_to_89"
  | "90_to_233"
  | "234_plus";

function bucketNodeCount(nodeCount: number): PipelineNodeBucket {
  if (nodeCount === 0) return "0";
  if (nodeCount <= 5) return "1_to_5";
  if (nodeCount <= 13) return "6_to_13";
  if (nodeCount <= 34) return "14_to_34";
  if (nodeCount <= 89) return "35_to_89";
  if (nodeCount <= 233) return "90_to_233";
  return "234_plus";
}

// ─── Daily throttle ───────────────────────────────────────────────────────────

type PipelineStatsStorageKeys = "tangle_pipeline_stats_last_fired_date";
type PipelineStatsStorageMapping = {
  tangle_pipeline_stats_last_fired_date: string; // ISO date, e.g. "2026-04-24"
};

const pipelineStatsStorage = getStorage<
  PipelineStatsStorageKeys,
  PipelineStatsStorageMapping
>({ encode: (v) => v as string, decode: (v) => v });

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasAlreadyFiredToday(): boolean {
  const lastFired = pipelineStatsStorage.getItem(
    "tangle_pipeline_stats_last_fired_date",
  );
  return lastFired === todayIsoDate();
}

function markFiredToday(): void {
  pipelineStatsStorage.setItem(
    "tangle_pipeline_stats_last_fired_date",
    todayIsoDate(),
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fires a `session.pipeline_stats.start` event at most once per day per client
 * with aggregate pipeline counts and a node-count distribution.
 *
 * Must be rendered inside `AnalyticsProvider`.
 */
export function useSessionPipelineStats(): void {
  const { track } = useAnalytics();

  useEffect(() => {
    if (hasAlreadyFiredToday()) return;
    markFiredToday();

    void (async () => {
      let total_pipelines = 0;
      const pipeline_node_buckets: Record<PipelineNodeBucket, number> = {
        "0": 0,
        "1_to_5": 0,
        "6_to_13": 0,
        "14_to_34": 0,
        "35_to_89": 0,
        "90_to_233": 0,
        "234_plus": 0,
      };

      try {
        const pipelines = await getAllComponentFilesFromList(
          USER_PIPELINES_LIST_NAME,
        );
        for (const [, entry] of pipelines) {
          total_pipelines++;
          const nodeCount = countPipelineNodes(entry.componentRef.spec);
          pipeline_node_buckets[bucketNodeCount(nodeCount)]++;
        }
      } catch {
        // Store unavailable — skip tracking.
        return;
      }

      track("session.pipeline_stats.start", {
        total_pipelines,
        pipeline_node_buckets,
      });
    })();
  }, [track]);
}
