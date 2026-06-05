import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/annotations";
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
  subgraphPath: string[];
  digest?: string;
  /** True when this task is already on the target (edited) version. */
  reconciled: boolean;
}

export interface PipelineLineageMatch {
  /** Storage key (also the pipeline route param). */
  storageKey: string;
  pipelineName: string;
  tasks: PipelineLineageTaskMatch[];
  /** Tasks sharing the origin but not yet on the target version. */
  pendingCount: number;
  /** Tasks already on the target version. */
  reconciledCount: number;
}

function walkSpec(
  spec: ComponentSpec | undefined,
  originId: string,
  targetDigest: string | undefined,
  path: string[],
  out: PipelineLineageTaskMatch[],
): void {
  const impl = spec?.implementation;
  if (!impl || !isGraphImplementation(impl)) return;

  for (const [taskName, task] of Object.entries(impl.graph.tasks)) {
    const lineage = parseLineage(task.annotations?.[LINEAGE_ORIGIN_ANNOTATION]);
    if (lineage?.originId === originId) {
      const digest = task.componentRef.digest;
      out.push({
        taskName,
        subgraphPath: path,
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
 * through subgraphs). Pipelines live client-side, so this is the cross-pipeline
 * discovery mechanism — no backend involved. `targetDigest` is the edited
 * version: tasks already at it are counted as reconciled, the rest as pending.
 *
 * Returns only pipelines with at least one matching task.
 */
export async function scanPipelinesForLineage(
  originId: string,
  targetDigest?: string,
): Promise<PipelineLineageMatch[]> {
  const files = await getAllComponentFilesFromList(USER_PIPELINES_LIST_NAME);

  const results: PipelineLineageMatch[] = [];
  for (const [storageKey, entry] of files) {
    const spec = (entry as ComponentFileEntry).componentRef.spec;
    const tasks: PipelineLineageTaskMatch[] = [];
    walkSpec(spec, originId, targetDigest, [], tasks);

    if (tasks.length === 0) continue;

    results.push({
      storageKey,
      pipelineName: spec?.name ?? storageKey,
      tasks,
      pendingCount: tasks.filter((t) => !t.reconciled).length,
      reconciledCount: tasks.filter((t) => t.reconciled).length,
    });
  }

  return results;
}
