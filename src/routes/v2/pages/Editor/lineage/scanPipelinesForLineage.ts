import {
  LINEAGE_EXCLUDE_ANNOTATION,
  LINEAGE_ORIGIN_ANNOTATION,
} from "@/utils/annotations";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { parseLineage } from "@/utils/lineage";

interface PipelineLineageTaskMatch {
  taskName: string;
  digest?: string;
  reconciled: boolean;
}

/**
 * A single reconcile target: a specific pipeline at a specific subgraph depth.
 * Each unique (storageKey, subgraphPath) pair is its own row in the overview so
 * the user can navigate directly to the right context.
 */
export interface ReconcileTarget {
  /** Storage key (also the pipeline route param). */
  storageKey: string;
  pipelineName: string;
  /**
   * Path of task names leading to this subgraph level.
   * Empty array = root level of the pipeline.
   */
  subgraphPath: string[];
  tasks: PipelineLineageTaskMatch[];
  pendingCount: number;
  reconciledCount: number;
  modifiedAt: Date | undefined;
  author: string | undefined;
}

function walkSpec(
  spec: ComponentSpec | undefined,
  originId: string,
  targetDigest: string | undefined,
  path: string[],
  out: Map<string, { path: string[]; tasks: PipelineLineageTaskMatch[] }>,
): void {
  const impl = spec?.implementation;
  if (!impl || !isGraphImplementation(impl)) return;

  const pathKey = path.join("\0");
  for (const [taskName, task] of Object.entries(impl.graph.tasks)) {
    const lineage = parseLineage(task.annotations?.[LINEAGE_ORIGIN_ANNOTATION]);
    const excluded = task.annotations?.[LINEAGE_EXCLUDE_ANNOTATION] === "true";
    if (lineage?.originId === originId && !excluded) {
      if (!out.has(pathKey)) out.set(pathKey, { path, tasks: [] });
      const digest = task.componentRef.digest;
      out.get(pathKey)!.tasks.push({
        taskName,
        digest,
        reconciled: targetDigest != null && digest === targetDigest,
      });
    }

    const nestedSpec = task.componentRef.spec;
    if (nestedSpec && isGraphImplementation(nestedSpec.implementation)) {
      walkSpec(nestedSpec, originId, targetDigest, [...path, taskName], out);
    }
  }
}

/**
 * Scan every locally-stored pipeline for tasks sharing `originId` (recursing
 * through subgraphs). Each unique (pipeline, subgraph depth) combination is
 * returned as a separate ReconcileTarget so the overview can navigate directly
 * to the right context. Results are sorted most-recently-updated first.
 */
export async function scanPipelinesForLineage(
  originId: string,
  targetDigest?: string,
): Promise<ReconcileTarget[]> {
  const files = await getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME);

  const results: ReconcileTarget[] = [];

  for (const [storageKey, entry] of files) {
    const fileEntry = entry as ComponentFileEntry;
    const spec = fileEntry.componentRef.spec;

    const grouped = new Map<
      string,
      { path: string[]; tasks: PipelineLineageTaskMatch[] }
    >();
    walkSpec(spec, originId, targetDigest, [], grouped);

    if (grouped.size === 0) continue;

    const pipelineName = spec?.name ?? storageKey;
    const modifiedAt = fileEntry.modificationTime;
    const author = spec?.metadata?.annotations?.author as string | undefined;

    for (const { path, tasks } of grouped.values()) {
      results.push({
        storageKey,
        pipelineName,
        subgraphPath: path,
        tasks,
        pendingCount: tasks.filter((t) => !t.reconciled).length,
        reconciledCount: tasks.filter((t) => t.reconciled).length,
        modifiedAt,
        author,
      });
    }
  }

  // Most recently updated first; no modification time goes last.
  results.sort((a, b) => {
    if (!a.modifiedAt && !b.modifiedAt) return 0;
    if (!a.modifiedAt) return 1;
    if (!b.modifiedAt) return -1;
    return b.modifiedAt.getTime() - a.modifiedAt.getTime();
  });

  return results;
}
