import { fetchPipelineRun } from "@/services/executionService";
import { findById } from "@/services/pipelineStorage/pipelineRegistry";
import type { PipelineRef } from "@/services/pipelineStorage/types";

const PIPELINE_PROTOCOL = "pipeline://";

/**
 * A resolved workarea view, ready to become a tab. The `id` is assigned by the
 * context when the tab is opened.
 */
export type ResolvedWorkareaView =
  | { kind: "artifact"; title: string; url: string }
  | { kind: "pipeline"; title: string; pipelineRef: PipelineRef }
  | { kind: "run"; title: string; runId: string };

export interface ResolveWorkareaTargetOptions {
  /** Backend base URL, used when a run has to be cloned into a draft. */
  backendUrl: string;
  /** Preferred tab title; falls back to a resolved name or the target. */
  title?: string;
}

/**
 * Extracts a run id from a `run:<id>` target or a run URL. Matches both the v1
 * (`/runs/<id>`) and v2 (`/runs-v2/<id>`) route shapes, with or without a
 * trailing subgraph-execution segment. Returns `null` when the target is not a
 * run.
 */
function extractRunId(target: string): string | null {
  if (target.startsWith("run:")) {
    const id = target.slice("run:".length).trim();
    return id.length > 0 ? id : null;
  }
  const match = target.match(/\/runs(?:-v2)?\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolves a string target into a concrete workarea view:
 * - `pipeline://<fileId>` opens the local draft editor.
 * - a run URL or `run:<id>` opens the run's canvas to inspect its execution.
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
    // Best-effort title: the run view handles its own loading/errors, so a
    // failed metadata fetch should still open the tab.
    const run = await fetchPipelineRun(runId, backendUrl).catch(
      () => undefined,
    );
    return {
      kind: "run",
      title: title ?? run?.pipeline_name ?? `Run ${runId}`,
      runId,
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
