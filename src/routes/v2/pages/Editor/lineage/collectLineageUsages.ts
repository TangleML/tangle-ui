import type { ComponentSpec, Task } from "@/models/componentSpec";
import {
  LINEAGE_EXCLUDE_ANNOTATION,
  LINEAGE_ORIGIN_ANNOTATION,
} from "@/utils/annotations";
import type { ComponentLineage } from "@/utils/lineage";

export interface LineageUsage {
  /** The task instance sharing the queried origin. */
  taskId: string;
  taskName: string;
  /** Current component digest of this instance (differs once locally edited). */
  digest?: string;
  /** The instance's full lineage record. */
  lineage: ComponentLineage;
  /** Subgraph task names from the root down to this task (empty at root level). */
  subgraphPath: string[];
}

/**
 * Find every task in `spec` — recursing through subgraphs — whose lineage origin
 * matches `originId`. This is the in-pipeline "find all usages across nesting"
 * primitive: it keys on the stable lineage origin (not the digest), so it still
 * groups instances whose digests have diverged through local edits.
 */
export function collectLineageUsages(
  spec: ComponentSpec,
  originId: string,
): LineageUsage[] {
  const matches: LineageUsage[] = [];

  const walk = (tasks: Task[], path: string[]) => {
    for (const task of tasks) {
      const lineage = task.annotations.get(LINEAGE_ORIGIN_ANNOTATION);
      const excluded =
        task.annotations.get(LINEAGE_EXCLUDE_ANNOTATION) === "true";
      if (lineage && lineage.originId === originId && !excluded) {
        matches.push({
          taskId: task.$id,
          taskName: task.name,
          digest: task.componentRef.digest,
          lineage,
          subgraphPath: path,
        });
      }
      if (task.subgraphSpec) {
        walk(task.subgraphSpec.tasks, [...path, task.name]);
      }
    }
  };

  walk(spec.tasks, []);
  return matches;
}
