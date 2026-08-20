import {
  fetchExecutionDetails,
  fetchPipelineRun,
} from "@/services/executionService";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import { findById } from "@/services/pipelineStorage/pipelineRegistry";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import type { ComponentSpec } from "@/utils/componentSpec";

const PIPELINE_PROTOCOL = "pipeline://";

/**
 * A resolved workarea view, ready to become a tab. The `id` is assigned by the
 * context when the tab is opened.
 */
export type ResolvedWorkareaView =
  | { kind: "artifact"; title: string; url: string }
  | { kind: "pipeline"; title: string; pipelineRef: PipelineRef };

export interface ResolveWorkareaTargetOptions {
  /** Backend base URL, used when a run has to be cloned into a draft. */
  backendUrl: string;
  /** Preferred tab title; falls back to a resolved name or the target. */
  title?: string;
}

/**
 * Extracts a run id from a `run:<id>` target or a run URL such as
 * `https://host/runs/v2/123`. Returns `null` when the target is not a run.
 */
function extractRunId(target: string): string | null {
  if (target.startsWith("run:")) {
    const id = target.slice("run:".length).trim();
    return id.length > 0 ? id : null;
  }
  const match = target.match(/\/runs\/(?:v1|v2)\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Clones a run into a local draft pipeline and returns a ref to open it. Reads
 * the run's component spec from its root execution, mirroring how RunView seeds
 * its spec, then reuses the shared clone service.
 */
async function clonePipelineFromRun(
  runId: string,
  backendUrl: string,
): Promise<PipelineRef> {
  const run = await fetchPipelineRun(runId, backendUrl);
  const rootExecutionId = run.root_execution_id
    ? String(run.root_execution_id)
    : runId;
  const details = await fetchExecutionDetails(rootExecutionId, backendUrl);
  const spec = details.task_spec.componentRef.spec;
  if (!spec) {
    throw new Error("This run has no pipeline spec to clone.");
  }

  // The API response uses `ComponentSpecOutput` (nullable name) while the clone
  // service works with the domain `ComponentSpec`; the divergence is only in
  // optionality, so a cast is safe here (same pattern as RunView).
  const result = await copyRunToPipeline(spec as ComponentSpec, runId);
  if (!result.name) {
    throw new Error("Failed to clone the run into a pipeline.");
  }
  return { name: result.name };
}

/**
 * Resolves a string target into a concrete workarea view:
 * - `pipeline://<fileId>` opens the local draft editor.
 * - a run URL or `run:<id>` clones the run into a draft and opens it.
 * - an `http(s)` URL opens the artifact viewer.
 * - anything else is treated as a pipeline name.
 */
export async function resolveWorkareaTarget(
  target: string,
  options: ResolveWorkareaTargetOptions,
): Promise<ResolvedWorkareaView> {
  const trimmed = target.trim();
  const { backendUrl, title } = options;

  if (trimmed.startsWith(PIPELINE_PROTOCOL)) {
    const fileId = trimmed.slice(PIPELINE_PROTOCOL.length);
    const entry = await findById(fileId).catch(() => undefined);
    const name = title ?? entry?.storageKey ?? fileId;
    return { kind: "pipeline", title: name, pipelineRef: { name, fileId } };
  }

  const runId = extractRunId(trimmed);
  if (runId) {
    const pipelineRef = await clonePipelineFromRun(runId, backendUrl);
    return {
      kind: "pipeline",
      title: title ?? pipelineRef.name,
      pipelineRef,
    };
  }

  if (/^https?:\/\//.test(trimmed)) {
    return { kind: "artifact", title: title ?? trimmed, url: trimmed };
  }

  return {
    kind: "pipeline",
    title: title ?? trimmed,
    pipelineRef: { name: trimmed },
  };
}
